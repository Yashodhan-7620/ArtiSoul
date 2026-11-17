// End-to-end API tests: a real Express app against a real (throwaway) MySQL.
//
//   DB_NAME=artisoul_test DB_HOST=... DB_USER=... DB_PASSWORD=... npm test
//
// The database must already have backend/schema/artisoul_full_schema.sql
// loaded. As a safety net the tests refuse to run unless the database name
// contains "test" and the host is not a hosted (Railway) database.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

if (!/test/i.test(process.env.DB_NAME || '') || /rlwy\.net|railway/i.test(process.env.DB_HOST || '')) {
  throw new Error('Refusing to run tests: set DB_NAME to a *test* database on a local/CI MySQL server.');
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-secret';
delete process.env.ANTHROPIC_API_KEY; // AI must report "not configured" in tests

const app = require('../src/app');
const { pool } = require('../src/config/db');

let server;
let base;
const run = Date.now().toString().slice(-6);
const phone = (n) => `9${run}${String(n).padStart(3, '0')}`;

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json, headers: res.headers };
}

async function signup(role, n, name) {
  const r = await api('POST', '/api/auth/register', {
    body: { role, name, phone: phone(n), password: 'secret123' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token: r.body.data.token, id: r.body.data.user.user_id, phone: phone(n) };
}

const S = {}; // shared state across the ordered tests

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  S.artisan = await signup('artisan', 1, 'Meera Weaver');
  S.buyer = await signup('customer', 2, 'Asha Buyer');
  S.buyer2 = await signup('customer', 3, 'Ravi Other');
  S.admin = await signup('customer', 4, 'Site Admin');
  await pool.query("UPDATE Users SET role = 'admin' WHERE user_id = ?", [S.admin.id]);

  const shop = await api('POST', '/api/shops/create', {
    token: S.artisan.token,
    body: { shop_name: 'Meera Looms', latitude: 18.52, longitude: 73.85, address: 'Pune', image_url: '/uploads/shop.jpg' },
  });
  assert.equal(shop.status, 201);
  S.shopId = shop.body.data.shop_id;

  const add = (name, price, stock, category) =>
    api('POST', '/api/products/add', {
      token: S.artisan.token,
      body: { shop_id: S.shopId, name, price, stock_quantity: stock, category },
    });
  const p1 = await add('Ikat stole', 1200, 6, 'Textiles');
  const p2 = await add('Clay pot', 450, 10, 'Pottery');
  const p3 = await add('Brass lamp', 2200, 5, 'Metalwork');
  S.p1 = p1.body.data.product_id;
  S.p2 = p2.body.data.product_id;
  S.p3 = p3.body.data.product_id;
});

after(async () => {
  server?.close();
  await pool.end();
});

const delivery = { name: 'Asha Buyer', phone: '9876543210', address: '12 MG Road, Pune' };

test('security headers are set and the framework is not advertised', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('login: wrong password is rejected, then rate-limited after 5 failures', async () => {
  const victim = await signup('customer', 50, 'Locked Out');
  for (let i = 0; i < 5; i += 1) {
    const r = await api('POST', '/api/auth/login', { body: { phone: victim.phone, password: 'wrong-pass' } });
    assert.equal(r.status, 401);
  }
  const blocked = await api('POST', '/api/auth/login', { body: { phone: victim.phone, password: 'secret123' } });
  assert.equal(blocked.status, 429, 'even the right password is refused while locked');

  const ok = await api('POST', '/api/auth/login', { body: { phone: S.buyer.phone, password: 'secret123' } });
  assert.equal(ok.status, 200, 'other accounts are unaffected');
});

test('cart: add, cap at stock, and checkout turns it into orders with one payment', async () => {
  let r = await api('POST', '/api/cart', { token: S.buyer.token, body: { product_id: S.p1, quantity: 2 } });
  assert.equal(r.status, 201);
  r = await api('POST', '/api/cart', { token: S.buyer.token, body: { product_id: S.p2, quantity: 1 } });
  assert.equal(r.body.data.items.length, 2);
  assert.equal(r.body.data.total, 1200 * 2 + 450);

  r = await api('PUT', `/api/cart/${S.p2}`, { token: S.buyer.token, body: { quantity: 99 } });
  assert.equal(r.status, 409, 'more than in stock is refused');

  r = await api('GET', '/api/cart', { token: S.artisan.token });
  assert.equal(r.status, 403, 'artisans have no cart');

  r = await api('POST', '/api/orders/checkout-cart', { token: S.buyer.token, body: { payment_method: 'COD', ...delivery } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.order_ids.length, 2);
  S.orderA = r.body.data.order_ids[0]; // 2 x Ikat stole
  S.orderB = r.body.data.order_ids[1]; // 1 x Clay pot

  r = await api('GET', '/api/cart', { token: S.buyer.token });
  assert.equal(r.body.data.items.length, 0, 'cart is emptied after a COD checkout');

  const [[p1]] = await pool.query('SELECT stock_quantity FROM Products WHERE product_id = ?', [S.p1]);
  assert.equal(p1.stock_quantity, 4);

  const [[{ n }]] = await pool.query(
    "SELECT COUNT(*) AS n FROM Notifications WHERE user_id = ? AND type = 'new_order'",
    [S.artisan.id]
  );
  assert.equal(n, 2, 'artisan is told about each new order');
});

test('a negative quantity cannot be used to add stock', async () => {
  const before = (await pool.query('SELECT stock_quantity FROM Products WHERE product_id = ?', [S.p3]))[0][0];
  const r = await api('POST', '/api/orders', { token: S.buyer2.token, body: { product_id: S.p3, quantity: -5 } });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.quantity, 1);
  const after = (await pool.query('SELECT stock_quantity FROM Products WHERE product_id = ?', [S.p3]))[0][0];
  assert.equal(after.stock_quantity, before.stock_quantity - 1);
});

test('wishlists: at most two sections per buyer', async () => {
  const a = await api('POST', '/api/wishlists', { token: S.buyer2.token, body: { name: 'Diwali gifts' } });
  const b = await api('POST', '/api/wishlists', { token: S.buyer2.token, body: { name: 'For home' } });
  const c = await api('POST', '/api/wishlists', { token: S.buyer2.token, body: { name: 'Third' } });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(c.status, 409);
  S.wishlistA = a.body.data.wishlist_id;

  const add = await api('POST', `/api/wishlists/${S.wishlistA}/items`, { token: S.buyer2.token, body: { product_id: S.p1 } });
  assert.equal(add.status, 201);
  const other = await api('POST', `/api/wishlists/${S.wishlistA}/items`, { token: S.buyer.token, body: { product_id: S.p2 } });
  assert.equal(other.status, 404, "can't add to someone else's wishlist");

  const list = await api('GET', '/api/wishlists', { token: S.buyer2.token });
  assert.equal(list.body.data.lists.length, 2);
  assert.equal(list.body.data.lists[0].items[0].product_id, S.p1);
});

test('low stock alerts reach the artisan and buyers who wishlisted the piece', async () => {
  // Ikat stole: 4 left -> buying 1 leaves 3 (the alert threshold).
  const r = await api('POST', '/api/orders', { token: S.buyer.token, body: { product_id: S.p1, quantity: 1 } });
  assert.equal(r.status, 201);
  const [rows] = await pool.query(
    "SELECT user_id, type FROM Notifications WHERE type IN ('low_stock', 'low_stock_buyer') AND JSON_EXTRACT(data, '$.product_id') = ?",
    [S.p1]
  );
  assert.ok(rows.some((n) => n.user_id === S.artisan.id && n.type === 'low_stock'), 'artisan alerted');
  assert.ok(rows.some((n) => n.user_id === S.buyer2.id && n.type === 'low_stock_buyer'), 'wishlisting buyer alerted');
});

test('order steps: accept -> schedule live -> ship -> deliver, with a timeline', async () => {
  const set = (status) => api('PATCH', `/api/orders/${S.orderA}/status`, { token: S.artisan.token, body: { status } });

  assert.equal((await set('Delivered')).status, 409, 'cannot skip straight to delivered');
  assert.equal((await set('Accepted')).status, 200);

  const past = await api('PATCH', `/api/orders/${S.orderA}/live-schedule`, {
    token: S.artisan.token,
    body: { scheduled_at: new Date(Date.now() - 3_600_000).toISOString() },
  });
  assert.equal(past.status, 400);
  const at = new Date(Date.now() + 86_400_000).toISOString();
  const sched = await api('PATCH', `/api/orders/${S.orderA}/live-schedule`, { token: S.artisan.token, body: { scheduled_at: at } });
  assert.equal(sched.status, 200);

  const early = await api('POST', `/api/orders/${S.orderA}/review`, { token: S.buyer.token, body: { rating: 5 } });
  assert.equal(early.status, 409, 'no review before delivery');

  assert.equal((await set('Shipped')).status, 200);
  assert.equal((await set('Delivered')).status, 200);

  const t = await api('GET', `/api/orders/${S.orderA}/timeline`, { token: S.buyer.token });
  assert.equal(t.status, 200);
  assert.deepEqual(
    t.body.data.events.map((e) => e.event),
    ['Placed', 'Accepted', 'LiveScheduled', 'Shipped', 'Delivered']
  );
  // DATETIME keeps whole seconds; the instant must match exactly (UTC, no 5.5 h shift).
  assert.equal(
    Math.floor(new Date(t.body.data.scheduled_live_at).getTime() / 1000),
    Math.floor(new Date(at).getTime() / 1000),
    'scheduled time round-trips in UTC'
  );

  const stranger = await api('GET', `/api/orders/${S.orderA}/timeline`, { token: S.buyer2.token });
  assert.equal(stranger.status, 404, "other buyers can't see this order");

  const [types] = await pool.query('SELECT type FROM Notifications WHERE user_id = ?', [S.buyer.id]);
  const seen = types.map((x) => x.type);
  assert.ok(seen.includes('order_status') && seen.includes('live_scheduled'));
});

test('reviews: once, after delivery, and the artisan is notified', async () => {
  const first = await api('POST', `/api/orders/${S.orderA}/review`, { token: S.buyer.token, body: { rating: 4, comment: 'Lovely weave' } });
  assert.equal(first.status, 201);
  const again = await api('POST', `/api/orders/${S.orderA}/review`, { token: S.buyer.token, body: { rating: 1 } });
  assert.equal(again.status, 409);
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM Notifications WHERE user_id = ? AND type = 'new_review'", [S.artisan.id]);
  assert.equal(n, 1);
});

test('COD: marked Paid only after delivery and both sides confirm', async () => {
  // orderA (COD) was delivered in the previous test.
  const confirm = (token, id = S.orderA) => api('POST', `/api/orders/${id}/cod-confirm`, { token });

  assert.equal((await confirm(S.buyer.token, S.orderB)).status, 409, 'not before delivery');
  assert.equal((await confirm(S.buyer2.token)).status, 404, 'strangers cannot confirm');

  const first = await confirm(S.buyer.token);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.payment_status, 'Pending', 'one side is not enough');
  assert.ok(first.body.data.cod_buyer_confirmed_at);

  const again = await confirm(S.buyer.token);
  assert.equal(again.body.data.payment_status, 'Pending', 'confirming twice from the same side does not count');

  const [[n1]] = await pool.query(
    "SELECT COUNT(*) AS n FROM Notifications WHERE user_id = ? AND type = 'cod_buyer_confirmed'",
    [S.artisan.id]
  );
  assert.equal(n1.n, 1, 'artisan asked to confirm, once');

  const second = await confirm(S.artisan.token);
  assert.equal(second.body.data.payment_status, 'Paid');

  const t = await api('GET', `/api/orders/${S.orderA}/timeline`, { token: S.buyer.token });
  assert.equal(t.body.data.events.at(-1).event, 'Paid');
  const [[n2]] = await pool.query(
    "SELECT COUNT(*) AS n FROM Notifications WHERE type = 'cod_paid' AND JSON_EXTRACT(data, '$.order_id') = ?",
    [S.orderA]
  );
  assert.equal(n2.n, 2, 'both sides told it is paid');
});

test('livestreams stay private to the order', async () => {
  // orderB is still Pending: can't stream until accepted.
  const offer = { type: 'offer', sdp: 'v=0\r\n' };
  let r = await api('POST', `/api/streams/${S.orderB}/start`, { token: S.artisan.token, body: { offer } });
  assert.equal(r.status, 409);
  await api('PATCH', `/api/orders/${S.orderB}/status`, { token: S.artisan.token, body: { status: 'Accepted' } });
  r = await api('POST', `/api/streams/${S.orderB}/start`, { token: S.artisan.token, body: { offer } });
  assert.equal(r.status, 201);

  assert.equal((await api('GET', `/api/streams/${S.orderB}`, { token: S.buyer.token })).body.data.status, 'live');
  assert.equal((await api('GET', `/api/streams/${S.orderB}`, { token: S.buyer2.token })).status, 404);

  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM Notifications WHERE user_id = ? AND type = 'live_now'", [S.buyer.id]);
  assert.equal(n, 1, 'buyer told the stream started');
});

test('notifications: list, unread count, mark read', async () => {
  let r = await api('GET', '/api/notifications/unread-count', { token: S.buyer.token });
  assert.ok(r.body.data.unread > 0);
  r = await api('POST', '/api/notifications/read', { token: S.buyer.token, body: {} });
  assert.equal(r.status, 200);
  r = await api('GET', '/api/notifications', { token: S.buyer.token });
  assert.equal(r.body.data.unread, 0);
  assert.ok(r.body.data.items.length > 0);
});

test('sales dashboard numbers for the artisan', async () => {
  const r = await api('GET', '/api/orders/sales', { token: S.artisan.token });
  assert.equal(r.status, 200);
  const d = r.body.data;
  assert.equal(d.totals.orders, 4);
  assert.equal(Number(d.totals.revenue), 1200 * 2 + 450 + 2200 + 1200);
  assert.equal(d.rating.count, 1);
  assert.ok(d.monthly.length >= 1);
  assert.ok(d.low_stock.some((p) => p.product_id === S.p1));
  assert.equal((await api('GET', '/api/orders/sales', { token: S.buyer.token })).status, 403);
});

test('recommendations: public, and skip what the buyer already bought', async () => {
  const anon = await api('GET', '/api/products/recommended?lat=18.52&lng=73.85');
  assert.equal(anon.status, 200);
  assert.ok(anon.body.data.length >= 1);
  const mine = await api('GET', '/api/products/recommended?lat=18.52&lng=73.85', { token: S.buyer.token });
  const ids = mine.body.data.map((p) => p.product_id);
  assert.ok(!ids.includes(S.p1) && !ids.includes(S.p2), 'already-bought pieces are not recommended');
});

test('AI listing reports "not set up" without an API key', async () => {
  const s = await api('GET', '/api/ai/status', { token: S.artisan.token });
  assert.equal(s.body.data.enabled, false);
  const res = await fetch(`${base}/api/ai/listing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${S.artisan.token}` },
    body: new FormData(),
  });
  assert.equal(res.status, 503);
});

test('artisan ranks: by delivered sales, figures stay private', async () => {
  const me = await api('GET', '/api/ranks/me', { token: S.artisan.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.orders, 1, 'only the delivered order counts');
  assert.equal(me.body.data.rank, 'newcomer');
  assert.equal(me.body.data.next.key, 'rising');
  assert.equal(me.body.data.next.orders_needed, 2);

  const pub = await api('GET', '/api/ranks');
  assert.equal(pub.body.data.rules.length, 6, '5 ranks + no rank');
  const row = pub.body.data.artisans.find((a) => a.shops.includes('Meera Looms'));
  assert.equal(row.rank, 'newcomer');
  assert.ok(!('revenue' in row) && !('orders' in row), 'no sales figures in public list');

  const detail = await api('GET', `/api/products/${S.p1}`);
  assert.equal(detail.body.data.artisan_rank, 'newcomer');
});

test('events: 30% of artisans say yes -> admin approves -> venue booked', async () => {
  // A venue slot 10 days ahead, and enough artisans that 30% means 2.
  const [v] = await pool.query(
    "INSERT INTO Venues (name, area, latitude, longitude, capacity_stalls) VALUES ('Test Ground', 'Pune', 18.5, 73.8, 50)"
  );
  const [sl] = await pool.query(
    "INSERT INTO VenueSlots (venue_id, starts_at, ends_at, price) VALUES (?, UTC_TIMESTAMP() + INTERVAL 10 DAY, UTC_TIMESTAMP() + INTERVAL 10 DAY + INTERVAL 8 HOUR, 40000)",
    [v.insertId]
  );
  const a2 = await signup('artisan', 60, 'Second Artisan');
  const a3 = await signup('artisan', 61, 'Third Artisan');
  await signup('artisan', 62, 'Fourth Artisan');
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM Users WHERE role = 'artisan' AND is_active = 1");
  const needed = Math.ceil(n * 0.3);

  const venues = await api('GET', '/api/events/venues');
  assert.ok(venues.body.data.some((x) => x.slots.some((s) => s.slot_id === sl.insertId)));

  const body = { slot_id: sl.insertId, title: 'Winter craft fair', activities: ['exhibit', 'sell', 'workshop'] };
  assert.equal((await api('POST', '/api/events', { token: S.buyer.token, body: { ...body, acknowledged: true } })).status, 403);
  assert.equal((await api('POST', '/api/events', { token: S.admin.token, body })).status, 400, 'must acknowledge');
  const created = await api('POST', '/api/events', { token: S.admin.token, body: { ...body, acknowledged: true } });
  assert.equal(created.status, 201);
  const eventId = created.body.data.event_id;
  assert.equal((await api('POST', '/api/events', { token: S.admin.token, body: { ...body, acknowledged: true } })).status, 409, 'one call per date');

  const [[call]] = await pool.query("SELECT COUNT(*) AS n FROM Notifications WHERE type = 'event_call'");
  assert.equal(call.n, n, 'every artisan is invited');

  const respond = (token, b) => api('POST', `/api/events/${eventId}/respond`, { token, body: b });
  assert.equal((await respond(a2.token, { response: 'yes', activities: ['sell'] })).status, 400, 'yes needs the acknowledgement');
  assert.equal((await respond(a2.token, { response: 'yes', activities: ['resale'], acknowledged: true })).status, 400, 'only the call\'s activities');
  const firstYes = await respond(a2.token, { response: 'yes', activities: ['sell'], acknowledged: true });
  assert.equal(firstYes.body.data.needed, needed);
  assert.equal((await respond(a2.token, { response: 'no' })).status, 409, 'a yes is final');

  assert.equal((await api('POST', `/api/events/${eventId}/approve`, { token: S.admin.token })).status, 409, 'not before 30%');
  assert.equal((await api('GET', '/api/events')).body.data.events.length, 0, 'buyers do not see unapproved calls');

  await respond(a3.token, { response: 'yes', activities: ['workshop'], acknowledged: true });
  const [[ev]] = await pool.query('SELECT status FROM Events WHERE event_id = ?', [eventId]);
  assert.equal(ev.status, 'pending_approval');
  const [[ask]] = await pool.query("SELECT COUNT(*) AS n FROM Notifications WHERE user_id = ? AND type = 'event_needs_approval'", [S.admin.id]);
  assert.equal(ask.n, 1, 'admin asked to approve, once');

  assert.equal((await api('POST', `/api/events/${eventId}/approve`, { token: S.artisan.token })).status, 403);
  assert.equal((await api('POST', `/api/events/${eventId}/approve`, { token: S.admin.token, body: {} })).status, 200);
  const [[slotNow]] = await pool.query('SELECT status FROM VenueSlots WHERE slot_id = ?', [sl.insertId]);
  assert.equal(slotNow.status, 'booked');

  const pub = await api('GET', '/api/events');
  const shown = pub.body.data.events.find((x) => x.event_id === eventId);
  assert.equal(shown.status, 'approved');
  assert.equal(shown.participants.length, 2);
  const [[ok]] = await pool.query("SELECT COUNT(*) AS n FROM Notifications WHERE type = 'event_approved'");
  assert.ok(ok.n >= 2, 'participants told');
});

test('admin panel: admins only, phones masked, no addresses, actions logged', async () => {
  assert.equal((await api('GET', '/api/admin/overview', { token: S.buyer.token })).status, 403);
  assert.equal((await api('GET', '/api/admin/overview')).status, 401);

  const o = await api('GET', '/api/admin/overview', { token: S.admin.token });
  assert.equal(o.status, 200);
  assert.ok(o.body.data.security.failed_logins_24h >= 5);

  const u = await api('GET', '/api/admin/users', { token: S.admin.token });
  const buyerRow = u.body.data.find((x) => x.user_id === S.buyer.id);
  assert.match(buyerRow.phone, /^\d{2}\*+\d{2}$/);
  assert.ok(!('password' in buyerRow));

  const orders = await api('GET', '/api/admin/orders', { token: S.admin.token });
  assert.ok(orders.body.data.length > 0);
  for (const row of orders.body.data) {
    assert.ok(!('delivery_address' in row) && !('delivery_phone' in row));
  }

  const act = await api('GET', '/api/admin/activity?action=auth.', { token: S.admin.token });
  assert.ok(act.body.data.items.some((x) => x.action === 'auth.login_failed'));
  assert.ok(act.body.data.items.every((x) => !x.ip_hash || /^[0-9a-f]{16}$/.test(x.ip_hash)), 'IPs only as hashes');

  // Suspend a buyer: their existing token stops working immediately.
  const bad = await api('PATCH', `/api/admin/users/${S.buyer2.id}/status`, { token: S.admin.token, body: { active: false } });
  assert.equal(bad.status, 400, 'a reason is required');
  const sus = await api('PATCH', `/api/admin/users/${S.buyer2.id}/status`, {
    token: S.admin.token,
    body: { active: false, reason: 'test suspension' },
  });
  assert.equal(sus.status, 200);
  assert.equal((await api('GET', '/api/cart', { token: S.buyer2.token })).status, 403);
  const self = await api('PATCH', `/api/admin/users/${S.admin.id}/status`, { token: S.admin.token, body: { active: false, reason: 'x' } });
  assert.equal(self.status, 403, 'admins cannot be suspended from the panel');

  const [[log]] = await pool.query("SELECT COUNT(*) AS n FROM AuditLog WHERE action = 'admin.user_suspend' AND entity_id = ?", [S.buyer2.id]);
  assert.equal(log.n, 1);
});
