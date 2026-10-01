const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

async function getConversation(conversationId, userId) {
  const [rows] = await pool.query(
    `SELECT c.*, s.shop_name, cu.name AS customer_name, a.name AS artisan_name
     FROM ChatConversations c
     JOIN Shops s ON s.shop_id = c.shop_id
     JOIN Users cu ON cu.user_id = c.customer_id
     JOIN Users a ON a.user_id = c.artisan_id
     WHERE c.conversation_id = ? AND (c.customer_id = ? OR c.artisan_id = ?)`,
    [conversationId, userId, userId]
  );
  return rows[0];
}

const openConversation = asyncHandler(async (req, res) => {
  const { shopId } = req.params;
  const userId = req.user.user_id;
  const [shops] = await pool.query('SELECT shop_id, artisan_id FROM Shops WHERE shop_id = ?', [shopId]);
  if (!shops.length) return res.status(404).json({ success: false, message: 'Shop not found' });
  if (req.user.role === 'artisan' && shops[0].artisan_id !== userId) {
    return res.status(403).json({ success: false, message: 'You do not own this shop' });
  }

  const customerId = req.user.role === 'customer' ? userId : Number(req.body.customer_id);
  if (!customerId) return res.status(400).json({ success: false, message: 'customer_id is required' });

  const [result] = await pool.query(
    `INSERT INTO ChatConversations (shop_id, customer_id, artisan_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE conversation_id = LAST_INSERT_ID(conversation_id)`,
    [shopId, customerId, shops[0].artisan_id]
  );
  const conversation = await getConversation(result.insertId, userId);
  res.status(201).json({ success: true, data: conversation });
});

const listConversations = asyncHandler(async (req, res) => {
  const column = req.user.role === 'artisan' ? 'c.artisan_id' : 'c.customer_id';
  const [rows] = await pool.query(
    `SELECT c.*, s.shop_name, cu.name AS customer_name, a.name AS artisan_name,
            (SELECT body FROM ChatMessages m WHERE m.conversation_id = c.conversation_id ORDER BY m.message_id DESC LIMIT 1) AS last_message
     FROM ChatConversations c
     JOIN Shops s ON s.shop_id = c.shop_id
     JOIN Users cu ON cu.user_id = c.customer_id
     JOIN Users a ON a.user_id = c.artisan_id
     WHERE ${column} = ? ORDER BY c.updated_at DESC`,
    [req.user.user_id]
  );
  res.json({ success: true, data: rows });
});

const getMessages = asyncHandler(async (req, res) => {
  const conversation = await getConversation(req.params.conversationId, req.user.user_id);
  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
  const [messages] = await pool.query(
    `SELECT m.message_id, m.sender_id, m.body, m.created_at, u.name AS sender_name
     FROM ChatMessages m JOIN Users u ON u.user_id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.message_id ASC`,
    [req.params.conversationId]
  );
  res.json({ success: true, data: messages });
});

const sendMessage = asyncHandler(async (req, res) => {
  const conversation = await getConversation(req.params.conversationId, req.user.user_id);
  if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
  const body = String(req.body.body || '').trim();
  if (!body || body.length > 1000) {
    return res.status(400).json({ success: false, message: 'Message must be between 1 and 1000 characters' });
  }
  const [result] = await pool.query(
    'INSERT INTO ChatMessages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
    [req.params.conversationId, req.user.user_id, body]
  );
  await pool.query('UPDATE ChatConversations SET updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?', [req.params.conversationId]);
  res.status(201).json({ success: true, data: { message_id: result.insertId, conversation_id: Number(req.params.conversationId), sender_id: req.user.user_id, body } });
});

module.exports = { openConversation, listConversations, getMessages, sendMessage };