// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, citizenOnly } = require('../middleware/auth');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');

router.use(verifyToken, citizenOnly);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
