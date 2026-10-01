const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { openConversation, listConversations, getMessages, sendMessage } = require('../controllers/chatController');

router.use(verifyToken);
router.get('/conversations', listConversations);
router.post('/shops/:shopId/conversation', openConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', sendMessage);

module.exports = router;