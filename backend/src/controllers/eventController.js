const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { audit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { artisanStats, nextStep, RULES } = require('../utils/ranks');

// Artisan events at well-known venues.
//
// Anyone (artisan or admin) can open a "call" for a free venue slot. Every
// artisan is told and answers yes/no. Saying yes is a serious, final
// commitment (the artisan must acknowledge that first). When at least 30% of
// all active artisans have said yes, the call moves to "pending_approval" and
// the admins are alerted; an admin then approves (books the venue) or rejects.

const ACTIVITIES = ['exhibit', 'sell', 'resale', 'popup_shop', 'meetup', 'inspire', 'workshop'];
const THRESHOLD = 0.3;
const ACTIVE = "('open','pending_approval','approved')";

function cleanActivities(list, allowed = ACTIVITIES) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((a) => allowed.includes(a)))];
}

async function artisanCount() {
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM Users WHERE role = 'artisan' AND is_active = 1");
  return n;
}
const neededFor = (total) => Math.max(1, Math.ceil(total * THRESHOLD));

// GET /api/events/venues  (public) - the 10 venues with their free upcoming slots.
const listVenues = asyncHandler(async (req, res) => {
  const [venues] = await pool.query('SELECT * FROM Venues ORDER BY venue_id');
  const [slots] = await pool.query(
    `SELECT sl.slot_id, sl.venue_id, sl.starts_at, sl.ends_at, sl.price, sl.status,
            (SELECT e.event_id FROM Events e WHERE e.slot_id = sl.slot_id AND e.status IN ${ACTIVE} LIMIT 1) AS event_id
     FROM VenueSlots sl
     WHERE sl.starts_at > UTC_TIMESTAMP()
     ORDER BY sl.starts_at`
  );
  res.json({
    success: true,
    data: venues.map((v) => ({ ...v, slots: slots.filter((s) => s.venue_id === v.venue_id) })),
  });
});

// GET /api/events  - artisans/admins see open, pending and approved calls;
// buyers and visitors see approved events only.
const listEvents = asyncHandler(async (req, res) => {
  const insider = ['artisan', 'admin'].includes(req.user?.role);
  const [events] = await pool.query(
    `SELECT e.event_id, e.title, e.description, e.activities, e.status, e.decision_note, e.created_at,
            e.created_by, cu.name AS created_by_name, cu.role AS created_by_role,
            sl.slot_id, sl.starts_at, sl.ends_at, sl.price,
            v.venue_id, v.name AS venue_name, v.area, v.city, v.latitude, v.longitude, v.capacity_stalls,
            (SELECT COUNT(*) FROM EventResponses r WHERE r.event_id = e.event_id AND r.response = 'yes') AS yes_count,
            (SELECT COUNT(*) FROM EventResponses r WHERE r.event_id = e.event_id AND r.response = 'no') AS no_count
     FROM Events e
     JOIN VenueSlots sl ON sl.slot_id = e.slot_id
     JOIN Venues v ON v.venue_id = sl.venue_id
     JOIN Users cu ON cu.user_id = e.created_by
     WHERE sl.ends_at > UTC_TIMESTAMP() AND e.status IN ${insider ? "('open','pending_approval','approved')" : "('approved')"}
     ORDER BY sl.starts_at`
  );

  const ids = events.map((e) => e.event_id);
  const [participants] = ids.length
    ? await pool.query(
        `SELECT r.event_id, r.artisan_id, r.activities,
                (SELECT GROUP_CONCAT(s.shop_name ORDER BY s.shop_id SEPARATOR ', ') FROM Shops s WHERE s.artisan_id = r.artisan_id) AS shops
         FROM EventResponses r WHERE r.event_id IN (?) AND r.response = 'yes' ORDER BY r.responded_at`,
        [ids]
      )
    : [[]];
  const [mine] = ids.length && req.user?.role === 'artisan'
    ? await pool.query('SELECT event_id, response, activities FROM EventResponses WHERE artisan_id = ? AND event_id IN (?)', [req.user.user_id, ids])
    : [[]];

  const total = await artisanCount();
  const split = (set) => (set ? String(set).split(',').filter(Boolean) : []);
  res.json({
    success: true,
    data: {
      total_artisans: total,
      needed: neededFor(total),
      threshold: THRESHOLD,
      events: events.map((e) => {
        const my = mine.find((m) => m.event_id === e.event_id);
        return {
          ...e,
          activities: split(e.activities),
          created_by_name: e.created_by_role === 'admin' ? null : e.created_by_name,
          participants: participants
            .filter((p) => p.event_id === e.event_id)
            .map((p) => ({ shops: p.shops || '', activities: split(p.activities) })),
          my_response: my ? { response: my.response, activities: split(my.activities) } : null,
        };
      }),
    },
  });
});

// Moves an open call to pending_approval once enough artisans said yes, and
// alerts the admins (exactly once, thanks to the status guard).
async function checkThreshold(eventId) {
  const total = await artisanCount();
  const needed = neededFor(total);
  const [[{ yes }]] = await pool.query(
    "SELECT COUNT(*) AS yes FROM EventResponses WHERE event_id = ? AND response = 'yes'",
    [eventId]
  );
  if (yes >= needed) {
    const [r] = await pool.query("UPDATE Events SET status = 'pending_approval' WHERE event_id = ? AND status = 'open'", [eventId]);
    if (r.affectedRows) {
      const [[e]] = await pool.query('SELECT title FROM Events WHERE event_id = ?', [eventId]);
      const [admins] = await pool.query("SELECT user_id FROM Users WHERE role = 'admin' AND is_active = 1");
      await notify(admins.map((a) => a.user_id), 'event_needs_approval', { event_id: eventId, title: e.title, yes, total }, '/events');
    }
  }
  return { yes, needed, total };
}

// POST /api/events   (artisan or admin)
// Body: { slot_id, title, description?, activities: [...], acknowledged }
const createEvent = asyncHandler(async (req, res) => {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const activities = cleanActivities(req.body.activities);
  if (title.length < 3 || title.length > 120) {
    return res.status(400).json({ success: false, message: 'Title must be 3 to 120 characters' });
  }
  if (description.length > 1000) return res.status(400).json({ success: false, message: 'Description is too long' });
  if (!activities.length) return res.status(400).json({ success: false, message: 'Pick at least one activity' });
  if (req.body.acknowledged !== true) {
    return res.status(400).json({ success: false, message: 'Please confirm you understand this is a serious event' });
  }

  const [[slot]] = await pool.query(
    `SELECT sl.slot_id, sl.status, sl.starts_at, v.name AS venue_name FROM VenueSlots sl
     JOIN Venues v ON v.venue_id = sl.venue_id
     WHERE sl.slot_id = ? AND sl.starts_at > UTC_TIMESTAMP() + INTERVAL 1 DAY`,
    [req.body.slot_id]
  );
  if (!slot) return res.status(404).json({ success: false, message: 'That date is not available (it must be at least a day away)' });
  if (slot.status !== 'available') return res.status(409).json({ success: false, message: 'That date is already booked' });
  const [[taken]] = await pool.query(`SELECT event_id FROM Events WHERE slot_id = ? AND status IN ${ACTIVE}`, [slot.slot_id]);
  if (taken) return res.status(409).json({ success: false, message: 'There is already a call for that date. Join it instead.' });

  const [r] = await pool.query(
    'INSERT INTO Events (slot_id, created_by, title, description, activities) VALUES (?, ?, ?, ?, ?)',
    [slot.slot_id, req.user.user_id, title, description || null, activities.join(',')]
  );
  const eventId = r.insertId;

  // An artisan who opens a call is its first participant.
  if (req.user.role === 'artisan') {
    await pool.query(
      "INSERT INTO EventResponses (event_id, artisan_id, response, activities, acknowledged) VALUES (?, ?, 'yes', ?, 1)",
      [eventId, req.user.user_id, activities.join(',')]
    );
  }

  const [artisans] = await pool.query(
    "SELECT user_id FROM Users WHERE role = 'artisan' AND is_active = 1 AND user_id <> ?",
    [req.user.user_id]
  );
  await notify(artisans.map((a) => a.user_id), 'event_call', { event_id: eventId, title, venue: slot.venue_name, at: slot.starts_at }, '/events');
  await audit(req, 'event.create', { entity: 'event', entityId: eventId, details: { slot_id: slot.slot_id, activities } });

  const counts = await checkThreshold(eventId);
  res.status(201).json({ success: true, data: { event_id: eventId, ...counts } });
});

// POST /api/events/:id/respond   (artisan)
// Body: { response: 'yes'|'no', activities?: [...], acknowledged? }
const respond = asyncHandler(async (req, res) => {
  const response = req.body.response;
  if (!['yes', 'no'].includes(response)) return res.status(400).json({ success: false, message: "Answer 'yes' or 'no'" });

  const [[event]] = await pool.query(
    `SELECT e.event_id, e.status, e.activities, sl.starts_at FROM Events e JOIN VenueSlots sl ON sl.slot_id = e.slot_id
     WHERE e.event_id = ?`,
    [req.params.id]
  );
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
  if (!['open', 'pending_approval'].includes(event.status) || new Date(event.starts_at) <= new Date()) {
    return res.status(409).json({ success: false, message: 'This call is closed' });
  }

  const [[existing]] = await pool.query('SELECT response FROM EventResponses WHERE event_id = ? AND artisan_id = ?', [
    event.event_id,
    req.user.user_id,
  ]);
  if (existing?.response === 'yes') {
    return res.status(409).json({
      success: false,
      message: 'You already committed to this event. A yes cannot be withdrawn; contact the admin if something serious has come up.',
    });
  }

  let activities = [];
  if (response === 'yes') {
    if (req.body.acknowledged !== true) {
      return res.status(400).json({ success: false, message: 'Please confirm you understand this is a serious commitment' });
    }
    activities = cleanActivities(req.body.activities, String(event.activities).split(','));
    if (!activities.length) return res.status(400).json({ success: false, message: 'Pick what you will do at the event' });
  }

  await pool.query(
    `INSERT INTO EventResponses (event_id, artisan_id, response, activities, acknowledged) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE response = VALUES(response), activities = VALUES(activities), acknowledged = VALUES(acknowledged)`,
    [event.event_id, req.user.user_id, response, activities.join(',') || null, response === 'yes' ? 1 : 0]
  );
  await audit(req, 'event.respond', { entity: 'event', entityId: event.event_id, details: { response, activities } });
  const counts = await checkThreshold(event.event_id);
  res.json({ success: true, data: { event_id: event.event_id, response, ...counts } });
});

async function participantIds(eventId) {
  const [rows] = await pool.query("SELECT artisan_id FROM EventResponses WHERE event_id = ? AND response = 'yes'", [eventId]);
  return rows.map((r) => r.artisan_id);
}

// POST /api/events/:id/approve   (admin) - books the venue slot.
const approveEvent = asyncHandler(async (req, res) => {
  const note = String(req.body?.note || '').trim().slice(0, 300) || null;
  const [[event]] = await pool.query('SELECT event_id, status, slot_id, title, created_by FROM Events WHERE event_id = ?', [req.params.id]);
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
  if (event.status !== 'pending_approval') {
    return res.status(409).json({ success: false, message: 'Only calls that reached 30% of artisans can be approved' });
  }
  const [booked] = await pool.query("UPDATE VenueSlots SET status = 'booked' WHERE slot_id = ? AND status = 'available'", [event.slot_id]);
  if (!booked.affectedRows) return res.status(409).json({ success: false, message: 'That venue date is no longer available' });

  await pool.query(
    "UPDATE Events SET status = 'approved', decided_by = ?, decision_note = ?, decided_at = UTC_TIMESTAMP() WHERE event_id = ?",
    [req.user.user_id, note, event.event_id]
  );
  const people = await participantIds(event.event_id);
  await notify([...people, event.created_by], 'event_approved', { event_id: event.event_id, title: event.title }, '/events');
  await audit(req, 'admin.event_approve', { entity: 'event', entityId: event.event_id, details: { slot_id: event.slot_id, participants: people.length } });
  res.json({ success: true, data: { event_id: event.event_id, status: 'approved' } });
});

// POST /api/events/:id/reject   (admin)   Body: { note } (required)
const rejectEvent = asyncHandler(async (req, res) => {
  const note = String(req.body?.note || '').trim().slice(0, 300);
  if (!note) return res.status(400).json({ success: false, message: 'Give a reason' });
  const [[event]] = await pool.query('SELECT event_id, status, title, created_by FROM Events WHERE event_id = ?', [req.params.id]);
  if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
  if (!['open', 'pending_approval'].includes(event.status)) {
    return res.status(409).json({ success: false, message: 'This event has already been decided' });
  }
  await pool.query(
    "UPDATE Events SET status = 'rejected', decided_by = ?, decision_note = ?, decided_at = UTC_TIMESTAMP() WHERE event_id = ?",
    [req.user.user_id, note, event.event_id]
  );
  const people = await participantIds(event.event_id);
  await notify([...people, event.created_by], 'event_rejected', { event_id: event.event_id, title: event.title, reason: note }, '/events');
  await audit(req, 'admin.event_reject', { entity: 'event', entityId: event.event_id, details: { reason: note } });
  res.json({ success: true, data: { event_id: event.event_id, status: 'rejected' } });
});

// GET /api/ranks  (public) - artisans' ranks for the help page. Ranks and
// ratings only: sales figures stay private to each artisan.
const listRanks = asyncHandler(async (req, res) => {
  const stats = await artisanStats();
  const [shops] = await pool.query('SELECT artisan_id, shop_name FROM Shops ORDER BY shop_id');
  const rows = stats
    .map((s) => ({
      shops: shops.filter((sh) => sh.artisan_id === s.artisan_id).map((sh) => sh.shop_name).join(', '),
      rank: s.rank,
      rank_level: s.rank_level,
      rating: s.reviews ? s.rating : null,
      reviews: s.reviews,
      _sort: s.revenue,
    }))
    .filter((r) => r.shops)
    .sort((a, b) => a.rank_level - b.rank_level || b._sort - a._sort)
    .map(({ _sort, ...r }) => r);
  res.json({ success: true, data: { rules: RULES, artisans: rows } });
});

// GET /api/ranks/me  (artisan) - own numbers and what the next rank needs.
const myRank = asyncHandler(async (req, res) => {
  const [stats] = await artisanStats([req.user.user_id]);
  res.json({ success: true, data: { ...stats, next: nextStep(stats), rules: RULES } });
});

module.exports = { listVenues, listEvents, createEvent, respond, approveEvent, rejectEvent, listRanks, myRank, ACTIVITIES };
