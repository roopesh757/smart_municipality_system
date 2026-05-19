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
                SUM(CASE WHEN supporter_count > 0 THEN 1 ELSE 0 END) as high_impact,
                SUM(COALESCE(supporter_count, 0)) as total_supporters,
                SUM(CASE WHEN escalated = 1 THEN 1 ELSE 0 END) as escalated,
                SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) as urgent
             FROM complaints WHERE city = ?`,
            [city]
        );

        const [userCount] = await pool.query('SELECT COUNT(*) as total FROM users WHERE city = ?', [city]);

        // Area-wise breakdown
        const [areaStats] = await pool.query(
            `SELECT ward as area, COUNT(*) as total,
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
            areaStats,
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
    const { status, area, priority, problem_type, page = 1, limit = 20, sort = 'newest' } = req.query;

    try {
        let query = `
            SELECT c.*, u.username as citizen_name, u.mobile as citizen_mobile, u.email as citizen_email
            FROM complaints c JOIN users u ON c.user_id = u.id
            WHERE c.city = ?`;
        const params = [city];

        if (status) { query += ' AND c.status = ?'; params.push(status); }
        else { query += " AND c.status != 'Solved'"; } // Hide solved from default view
        if (area)   { query += ' AND c.ward = ?';   params.push(area); }
        if (priority) { query += ' AND c.priority = ?'; params.push(priority); }
        if (problem_type) { query += ' AND c.problem_type = ?'; params.push(problem_type); }

        // Count
        const [countRows] = await pool.query(
            query.replace("SELECT c.*, u.username as citizen_name, u.mobile as citizen_mobile, u.email as citizen_email", 'SELECT COUNT(*) as total'),
            params
        );
        const total = countRows[0].total;

        // Sort
        const sortMap = { newest: 'c.created_at DESC', oldest: 'c.created_at ASC', priority: "FIELD(c.priority,'Urgent','High','Medium','Low')", impact: 'c.supporter_count DESC' };
        query += ` ORDER BY ${sortMap[sort] || 'c.created_at DESC'}`;

        // Paginate
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [complaints] = await pool.query(query, params);
        // Alias ward as area for frontend consistency
        complaints.forEach(c => { c.area = c.ward; });

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

        // Notify the original complaint owner
        await pool.query(
            'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
            [complaint.user_id, id, notifType,
             `Complaint Status Updated: ${status}`,
             notifMessages[status] || `Complaint #${id} status updated to ${status}.`]
        );

        // Notify all supporters of the complaint
        const [supporters] = await pool.query(
            'SELECT user_id FROM complaint_supporters WHERE complaint_id = ?',
            [id]
        );

        if (supporters.length > 0) {
            const notifValues = supporters.map(s =>
                [s.user_id, id, notifType,
                 `Joined Complaint Status Updated: ${status}`,
                 notifMessages[status] || `Complaint #${id} you joined has been updated to ${status}.`]
            );

            for (const vals of notifValues) {
                await pool.query(
                    'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
                    vals
                );
            }
        }

        res.json({ success: true, message: `Complaint status updated to "${status}".` });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── Get Users in Admin's City ────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Returns:
 *  - Local residents (users registered in the admin's city)
 *  - Cross-municipality reporters (users who submitted complaints to this city but are from elsewhere)
 */
const getCityUsers = async (req, res) => {
    const { city } = req.user;
    try {
        // Local residents
        const [localUsers] = await pool.query(
            `SELECT u.id, u.username, u.email, u.mobile, u.ward as area, u.city as home_city, u.created_at,
                    COUNT(c.id) as complaint_count, 1 as is_local
             FROM users u
             LEFT JOIN complaints c ON u.id = c.user_id
             WHERE u.city = ?
             GROUP BY u.id ORDER BY u.created_at DESC`,
            [city]
        );

        // Cross-municipality reporters (users from other cities who filed complaints here)
        const [crossUsers] = await pool.query(
            `SELECT u.id, u.username, u.email, u.mobile, u.ward as area, u.city as home_city, u.created_at,
                    COUNT(c.id) as complaint_count, 0 as is_local
             FROM users u
             INNER JOIN complaints c ON u.id = c.user_id AND c.city = ?
             WHERE u.city != ?
             GROUP BY u.id ORDER BY complaint_count DESC`,
            [city, city]
        );

        const users = [...localUsers, ...crossUsers];
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
                    u.email as citizen_email
             FROM complaints c JOIN users u ON c.user_id = u.id
             WHERE c.id = ? AND c.city = ?`,
            [id, city]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }
        const complaint = rows[0];
        complaint.area = complaint.ward;

        // Get supporter details
        const [supporters] = await pool.query(
            `SELECT u.username, u.email, u.mobile, u.ward as area, u.city as home_city, cs.joined_at
             FROM complaint_supporters cs
             JOIN users u ON cs.user_id = u.id
             WHERE cs.complaint_id = ?
             ORDER BY cs.joined_at DESC`,
            [id]
        );

        res.json({ success: true, complaint, supporters });
    } catch (error) {
        console.error('Get complaint detail error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── Get High Impact Complaints ───────────────────────────────────────────────

/**
 * GET /api/admin/high-impact
 * Returns complaints that have supporters (public impact).
 */
const getHighImpactComplaints = async (req, res) => {
    const { city } = req.user;
    try {
        const [complaints] = await pool.query(
            `SELECT c.*, u.username as citizen_name
             FROM complaints c JOIN users u ON c.user_id = u.id
             WHERE c.city = ? AND c.supporter_count > 0
             ORDER BY c.supporter_count DESC, c.created_at DESC`,
            [city]
        );
        complaints.forEach(c => { c.area = c.ward; });
        res.json({ success: true, complaints });
    } catch (error) {
        console.error('Get high impact complaints error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── Delete User (Admin) ──────────────────────────────────────────────────────

/**
 * DELETE /api/admin/users/:id
 * Permanently delete a citizen user and all their data (complaints, notifications)
 */
const deleteUser = async (req, res) => {
    const { city } = req.user;
    const { id } = req.params;

    try {
        // Verify user belongs to admin's city
        const [users] = await pool.query('SELECT id, username, email FROM users WHERE id = ? AND city = ?', [id, city]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found in your city.' });
        }

        const user = users[0];

        // Delete user — CASCADE will remove complaints and notifications automatically
        await pool.query('DELETE FROM users WHERE id = ?', [id]);

        res.json({ success: true, message: `User "${user.username}" and all their data have been permanently removed.` });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = {
    getDashboardStats, getAllComplaints, updateComplaintStatus,
    getCityUsers, getComplaintDetail, getHighImpactComplaints, deleteUser
};
