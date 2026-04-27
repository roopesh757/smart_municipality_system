// controllers/notificationController.js - Notification Management
const pool = require('../config/db');

/**
 * GET /api/notifications - Get user's notifications
 */
const getNotifications = async (req, res) => {
    const userId = req.user.id;
    const { unread_only } = req.query;

    try {
        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [userId];

        if (unread_only === 'true') {
            query += ' AND is_read = 0';
        }
        query += ' ORDER BY created_at DESC LIMIT 50';

        const [notifications] = await pool.query(query, params);
        const [countRow] = await pool.query(
            'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );

        res.json({ success: true, notifications, unreadCount: countRow[0].unread });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/**
 * PUT /api/notifications/:id/read - Mark notification as read
 */
const markAsRead = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        res.json({ success: true, message: 'Notification marked as read.' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/**
 * PUT /api/notifications/read-all - Mark all notifications as read
 */
const markAllAsRead = async (req, res) => {
    const userId = req.user.id;

    try {
        await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
        res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { getNotifications, markAsRead, markAllAsRead };
