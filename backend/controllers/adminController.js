// controllers/adminController.js - Admin Dashboard Logic
const pool = require('../config/db');

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard
 */
const getDashboardStats = async (req, res) => {
    const { city } = req.user;
    try {
        const [stats] = await pool.query(
            `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'Solved' THEN 1 ELSE 0 END) as solved,
                SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicates,
                SUM(CASE WHEN escalated = 1 THEN 1 ELSE 0 END) as escalated,
                SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) as urgent
             FROM complaints WHERE city = ?`,
            [city]
        );

        const [userCount] = await pool.query('SELECT COUNT(*) as total FROM users WHERE city = ?', [city]);

        // Ward-wise breakdown
        const [wardStats] = await pool.query(
            `SELECT ward, COUNT(*) as total,
                    SUM(CASE WHEN status = 'Solved' THEN 1 ELSE 0 END) as solved
             FROM complaints WHERE city = ? GROUP BY ward ORDER BY total DESC`,
            [city]
        );

        // Problem type breakdown
        const [typeStats] = await pool.query(
            `SELECT problem_type, COUNT(*) as total
             FROM complaints WHERE city = ? GROUP BY problem_type ORDER BY total DESC`,
            [city]
        );

        res.json({
            success: true,
            stats: stats[0],
            userCount: userCount[0].total,
            wardStats,
            typeStats
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── Get All Complaints (Admin City) ─────────────────────────────────────────

/**
 * GET /api/admin/complaints
 */
const getAllComplaints = async (req, res) => {
    const { city } = req.user;
    const { status, ward, priority, problem_type, page = 1, limit = 20, sort = 'newest' } = req.query;

    try {
        let query = `
            SELECT c.*, u.username as citizen_name, u.mobile as citizen_mobile, u.email as citizen_email
            FROM complaints c JOIN users u ON c.user_id = u.id
            WHERE c.city = ?`;
        const params = [city];

        if (status) { query += ' AND c.status = ?'; params.push(status); }
        if (ward) { query += ' AND c.ward = ?'; params.push(ward); }
        if (priority) { query += ' AND c.priority = ?'; params.push(priority); }
        if (problem_type) { query += ' AND c.problem_type = ?'; params.push(problem_type); }

        // Count
        const [countRows] = await pool.query(
            query.replace("SELECT c.*, u.username as citizen_name, u.mobile as citizen_mobile, u.email as citizen_email", 'SELECT COUNT(*) as total'),
            params
        );
        const total = countRows[0].total;

        // Sort
        const sortMap = { newest: 'c.created_at DESC', oldest: 'c.created_at ASC', priority: "FIELD(c.priority,'Urgent','High','Medium','Low')" };
        query += ` ORDER BY ${sortMap[sort] || 'c.created_at DESC'}`;

        // Paginate
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [complaints] = await pool.query(query, params);

        res.json({
            success: true,
            complaints,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Get all complaints error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── Update Complaint Status ──────────────────────────────────────────────────

/**
 * PUT /api/admin/complaints/:id/status
 */
const updateComplaintStatus = async (req, res) => {
    const { city } = req.user;
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const validStatuses = ['Submitted', 'Pending', 'In Progress', 'Solved', 'Rejected'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    try {
        // Verify complaint belongs to admin's city
        const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ? AND city = ?', [id, city]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        const complaint = rows[0];

        const resolvedAt = status === 'Solved' ? new Date() : null;
        await pool.query(
            'UPDATE complaints SET status = ?, admin_notes = ?, resolved_at = ? WHERE id = ?',
            [status, admin_notes || null, resolvedAt, id]
        );

        // Determine notification type
        const notifType = status === 'Solved' ? 'resolved' : status === 'Rejected' ? 'rejected' : 'status_update';
        const notifMessages = {
            'Pending': `Your complaint #${id} is now pending review.`,
            'In Progress': `Good news! Your complaint #${id} is now being addressed.`,
            'Solved': `Your complaint #${id} has been resolved! Thank you for reporting.`,
            'Rejected': `Your complaint #${id} has been rejected. ${admin_notes ? 'Reason: ' + admin_notes : ''}`
        };

        await pool.query(
            'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
            [complaint.user_id, id, notifType,
             `Complaint Status Updated: ${status}`,
             notifMessages[status] || `Complaint #${id} status updated to ${status}.`]
        );

        res.json({ success: true, message: `Complaint status updated to "${status}".` });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── Get Users in Admin's City ────────────────────────────────────────────────

/**
 * GET /api/admin/users
 */
const getCityUsers = async (req, res) => {
    const { city } = req.user;
    try {
        const [users] = await pool.query(
            `SELECT u.id, u.username, u.email, u.mobile, u.ward, u.created_at,
                    COUNT(c.id) as complaint_count
             FROM users u
             LEFT JOIN complaints c ON u.id = c.user_id
             WHERE u.city = ?
             GROUP BY u.id ORDER BY u.created_at DESC`,
            [city]
        );
        res.json({ success: true, users });
    } catch (error) {
        console.error('Get city users error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── Get Complaint Detail (Admin) ─────────────────────────────────────────────

/**
 * GET /api/admin/complaints/:id
 */
const getComplaintDetail = async (req, res) => {
    const { city } = req.user;
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT c.*, u.username as citizen_name, u.mobile as citizen_mobile,
                    u.email as citizen_email, u.ward as citizen_ward
             FROM complaints c JOIN users u ON c.user_id = u.id
             WHERE c.id = ? AND c.city = ?`,
            [id, city]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }
        res.json({ success: true, complaint: rows[0] });
    } catch (error) {
        console.error('Get complaint detail error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── Get Duplicate Complaints ─────────────────────────────────────────────────

/**
 * GET /api/admin/duplicates
 */
const getDuplicates = async (req, res) => {
    const { city } = req.user;
    try {
        const [duplicates] = await pool.query(
            `SELECT c.*, u.username as citizen_name
             FROM complaints c JOIN users u ON c.user_id = u.id
             WHERE c.city = ? AND c.is_duplicate = 1 ORDER BY c.created_at DESC`,
            [city]
        );
        res.json({ success: true, duplicates });
    } catch (error) {
        console.error('Get duplicates error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = {
    getDashboardStats, getAllComplaints, updateComplaintStatus,
    getCityUsers, getComplaintDetail, getDuplicates
};
