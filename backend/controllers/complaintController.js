// controllers/complaintController.js - Complaint Management Logic
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const PROBLEM_TYPES = [
    'Road damage / potholes',
    'Garbage issues',
    'Drainage/sewage overflow',
    'Street light issues',
    'Public toilet issues',
    'Damaged public property',
    'Blocked drains',
    'Broken footpaths',
    'Fallen trees',
    'Water leakage / pipeline break'
];

// ─── CITIZEN: Submit Complaint ────────────────────────────────────────────────

/**
 * POST /api/complaints
 */
const submitComplaint = async (req, res) => {
    const { title, description, problem_type, location, ward, priority } = req.body;
    const userId = req.user.id;
    const userCity = req.user.city;

    // Validation
    if (!title || !description || !problem_type || !location) {
        return res.status(400).json({ success: false, message: 'Title, description, problem type, and location are required.' });
    }
    if (!PROBLEM_TYPES.includes(problem_type)) {
        return res.status(400).json({ success: false, message: 'Invalid problem type.' });
    }

    const imagePath = req.file ? req.file.filename : null;

    try {
        // Get user's ward if not provided
        const [userRows] = await pool.query('SELECT ward, city FROM users WHERE id = ?', [userId]);
        const userWard = ward || userRows[0]?.ward || '';
        const city = userCity || userRows[0]?.city || '';

        // --- Duplicate Detection ---
        const [duplicates] = await pool.query(
            `SELECT id FROM complaints
             WHERE location = ? AND problem_type = ?
             AND status NOT IN ('Solved', 'Rejected')
             AND user_id != ?
             AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
             LIMIT 1`,
            [location, problem_type, userId]
        );

        const isDuplicate = duplicates.length > 0;
        const duplicateOf = isDuplicate ? duplicates[0].id : null;

        // Generate share token
        const shareToken = uuidv4().replace(/-/g, '');

        const [result] = await pool.query(
            `INSERT INTO complaints
             (user_id, title, description, problem_type, location, ward, city, priority, status, image_path, is_duplicate, duplicate_of, share_token)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?)`,
            [userId, title.trim(), description.trim(), problem_type, location.trim(),
             userWard, city, priority || 'Medium', imagePath, isDuplicate ? 1 : 0, duplicateOf, shareToken]
        );

        const complaintId = result.insertId;

        // Notification: Submission
        await pool.query(
            'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
            [userId, complaintId, 'complaint_submitted',
             'Complaint Submitted Successfully',
             `Your complaint "${title}" has been submitted and is being reviewed. Complaint ID: #${complaintId}`]
        );

        // Duplicate notification
        if (isDuplicate) {
            await pool.query(
                'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
                [userId, complaintId, 'duplicate',
                 'Similar Complaint Found',
                 `A similar complaint already exists for this location. Your complaint has been marked and will be tracked together.`]
            );
        }

        res.status(201).json({
            success: true,
            message: 'Complaint submitted successfully!',
            complaintId,
            isDuplicate,
            shareToken
        });
    } catch (error) {
        console.error('Submit complaint error:', error);
        // Delete uploaded file if error
        if (imagePath) {
            const filePath = path.join(__dirname, '../uploads', imagePath);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

// ─── CITIZEN: Get My Complaints ───────────────────────────────────────────────

/**
 * GET /api/complaints/my
 */
const getMyComplaints = async (req, res) => {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    try {
        let query = 'SELECT * FROM complaints WHERE user_id = ?';
        const params = [userId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        // Count total
        const [countRows] = await pool.query(query.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
        const total = countRows[0].total;

        // Paginate
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [complaints] = await pool.query(query, params);

        res.json({
            success: true,
            complaints,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Get my complaints error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── CITIZEN: Get Single Complaint ───────────────────────────────────────────

/**
 * GET /api/complaints/:id
 */
const getComplaint = async (req, res) => {
    const userId = req.user.id;
    const complaintId = req.params.id;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM complaints WHERE id = ? AND user_id = ?',
            [complaintId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        res.json({ success: true, complaint: rows[0] });
    } catch (error) {
        console.error('Get complaint error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── CITIZEN: Delete Complaint ────────────────────────────────────────────────

/**
 * DELETE /api/complaints/:id
 */
const deleteComplaint = async (req, res) => {
    const userId = req.user.id;
    const complaintId = req.params.id;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM complaints WHERE id = ? AND user_id = ?',
            [complaintId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found or not authorized.' });
        }

        const complaint = rows[0];

        // Delete image file if exists
        if (complaint.image_path) {
            const filePath = path.join(__dirname, '../uploads', complaint.image_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await pool.query('DELETE FROM complaints WHERE id = ?', [complaintId]);

        res.json({ success: true, message: 'Complaint deleted successfully.' });
    } catch (error) {
        console.error('Delete complaint error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── CITIZEN: Re-attempt Complaint ───────────────────────────────────────────

/**
 * POST /api/complaints/:id/reattempt
 */
const reattemptComplaint = async (req, res) => {
    const userId = req.user.id;
    const complaintId = req.params.id;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM complaints WHERE id = ? AND user_id = ?',
            [complaintId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        const complaint = rows[0];

        if (complaint.attempt_count >= 2) {
            // Mark as escalated
            await pool.query('UPDATE complaints SET escalated = 1 WHERE id = ?', [complaintId]);
            await pool.query(
                'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
                [userId, complaintId, 'escalation',
                 'Complaint Escalated',
                 `Your complaint #${complaintId} has been escalated to higher authorities after 2 failed attempts.`]
            );
            return res.status(400).json({
                success: false,
                message: 'Maximum attempts reached. Complaint has been escalated.',
                escalated: true
            });
        }

        if (!['Rejected'].includes(complaint.status)) {
            return res.status(400).json({ success: false, message: 'Can only re-attempt rejected complaints.' });
        }

        // Increment attempt count and reset status
        await pool.query(
            "UPDATE complaints SET attempt_count = attempt_count + 1, status = 'Submitted', escalated = 0 WHERE id = ?",
            [complaintId]
        );

        await pool.query(
            'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
            [userId, complaintId, 'complaint_submitted',
             'Complaint Re-submitted',
             `Your complaint #${complaintId} has been re-submitted (Attempt ${complaint.attempt_count + 1}/2).`]
        );

        res.json({ success: true, message: 'Complaint re-submitted successfully.' });
    } catch (error) {
        console.error('Reattempt error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── PUBLIC: Get Shared Complaint ─────────────────────────────────────────────

/**
 * GET /api/complaints/share/:token
 */
const getSharedComplaint = async (req, res) => {
    const { token } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT c.id, c.title, c.description, c.problem_type, c.location, c.ward, c.city,
                    c.priority, c.status, c.image_path, c.attempt_count, c.created_at, c.updated_at,
                    u.username as citizen_name
             FROM complaints c JOIN users u ON c.user_id = u.id
             WHERE c.share_token = ?`,
            [token]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Shared complaint not found.' });
        }

        res.json({ success: true, complaint: rows[0] });
    } catch (error) {
        console.error('Shared complaint error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = {
    submitComplaint, getMyComplaints, getComplaint,
    deleteComplaint, reattemptComplaint, getSharedComplaint
};
