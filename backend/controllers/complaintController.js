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

// ─── CITIZEN: Check for Matching Complaints ───────────────────────────────────

/**
 * POST /api/complaints/check-match
 * Before submitting, check if a similar complaint exists in the same area.
 * Returns matching complaint details if found, so user can choose to join.
 */
const checkMatchingComplaint = async (req, res) => {
    const { problem_type, complaint_district, complaint_area, complaint_state } = req.body;
    const userId = req.user.id;

    if (!problem_type || !complaint_district || !complaint_area) {
        return res.status(400).json({ success: false, message: 'Problem type, city, and area are required.' });
    }

    try {
        // ── Same-user duplicate prevention ──
        // Check if this user already owns an active complaint with matching criteria
        const [ownActive] = await pool.query(
            `SELECT id, title FROM complaints
             WHERE user_id = ? AND city = ? AND ward = ? AND problem_type = ?
             AND status NOT IN ('Solved', 'Rejected')
             LIMIT 1`,
            [userId, complaint_district, complaint_area, problem_type]
        );

        if (ownActive.length > 0) {
            return res.json({
                success: true,
                matchFound: false,
                userAlreadyActive: true,
                existingComplaintId: ownActive[0].id,
                message: 'You have already reported this complaint previously.'
            });
        }

        // Check if this user has already joined an active complaint with matching criteria
        const [joinedActive] = await pool.query(
            `SELECT c.id, c.title FROM complaints c
             INNER JOIN complaint_supporters cs ON c.id = cs.complaint_id
             WHERE cs.user_id = ? AND c.city = ? AND c.ward = ? AND c.problem_type = ?
             AND c.status NOT IN ('Solved', 'Rejected')
             LIMIT 1`,
            [userId, complaint_district, complaint_area, problem_type]
        );

        if (joinedActive.length > 0) {
            return res.json({
                success: true,
                matchFound: false,
                userAlreadyActive: true,
                existingComplaintId: joinedActive[0].id,
                message: 'You have already joined this complaint previously.'
            });
        }

        // ── Find other users' active complaints to potentially join ──
        const [matches] = await pool.query(
            `SELECT c.id, c.title, c.description, c.problem_type, c.location, c.ward, c.city,
                    c.priority, c.status, c.supporter_count, c.created_at, c.updated_at,
                    u.username as citizen_name
             FROM complaints c
             JOIN users u ON c.user_id = u.id
             WHERE c.city = ? AND c.ward = ? AND c.problem_type = ?
             AND c.status NOT IN ('Solved', 'Rejected')
             AND c.user_id != ?
             AND c.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
             ORDER BY c.supporter_count DESC, c.created_at DESC
             LIMIT 1`,
            [complaint_district, complaint_area, problem_type, userId]
        );

        if (matches.length === 0) {
            return res.json({ success: true, matchFound: false });
        }

        const match = matches[0];
        match.area = match.ward;

        // Check if user already joined this complaint (safety check)
        const [existing] = await pool.query(
            'SELECT id FROM complaint_supporters WHERE complaint_id = ? AND user_id = ?',
            [match.id, userId]
        );

        res.json({
            success: true,
            matchFound: true,
            alreadyJoined: existing.length > 0,
            complaint: match
        });
    } catch (error) {
        console.error('Check matching complaint error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── CITIZEN: Join Existing Complaint ─────────────────────────────────────────

/**
 * POST /api/complaints/:id/join
 * Link the user to an existing complaint as a supporter/affected citizen.
 */
const joinComplaint = async (req, res) => {
    const userId = req.user.id;
    const complaintId = req.params.id;

    try {
        // Verify complaint exists and is active
        const [rows] = await pool.query(
            `SELECT c.*, u.username as citizen_name
             FROM complaints c JOIN users u ON c.user_id = u.id
             WHERE c.id = ? AND c.status NOT IN ('Solved', 'Rejected')`,
            [complaintId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found or already resolved.' });
        }

        const complaint = rows[0];

        // Prevent owner from joining their own complaint
        if (complaint.user_id === userId) {
            return res.status(400).json({ success: false, message: 'You cannot join your own complaint.' });
        }

        // Check if already joined
        const [existing] = await pool.query(
            'SELECT id FROM complaint_supporters WHERE complaint_id = ? AND user_id = ?',
            [complaintId, userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'You have already joined this complaint.' });
        }

        // Add user as supporter
        await pool.query(
            'INSERT INTO complaint_supporters (complaint_id, user_id) VALUES (?, ?)',
            [complaintId, userId]
        );

        // Increment supporter count
        await pool.query(
            'UPDATE complaints SET supporter_count = supporter_count + 1 WHERE id = ?',
            [complaintId]
        );

        // Get updated supporter count
        const [updated] = await pool.query('SELECT supporter_count FROM complaints WHERE id = ?', [complaintId]);
        const newCount = updated[0].supporter_count;

        // Auto-escalate priority if many supporters join
        // 5+ supporters → High, 10+ → Urgent
        if (newCount >= 10 && complaint.priority !== 'Urgent') {
            await pool.query("UPDATE complaints SET priority = 'Urgent' WHERE id = ?", [complaintId]);
        } else if (newCount >= 5 && (complaint.priority === 'Low' || complaint.priority === 'Medium')) {
            await pool.query("UPDATE complaints SET priority = 'High' WHERE id = ?", [complaintId]);
        }

        // Notification for the joining user
        await pool.query(
            'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
            [userId, complaintId, 'complaint_joined',
             'Joined Existing Complaint',
             `You have joined complaint #${complaintId}: "${complaint.title}" in ${complaint.ward}, ${complaint.city}. You will receive status updates and resolution notifications.`]
        );

        // Notification for the original complaint owner
        await pool.query(
            'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
            [complaint.user_id, complaintId, 'complaint_joined',
             'New Supporter Joined Your Complaint',
             `Another citizen has joined your complaint #${complaintId}: "${complaint.title}". Total affected citizens: ${newCount + 1} (including you).`]
        );

        res.json({
            success: true,
            message: 'Successfully joined the complaint! You will receive updates.',
            supporterCount: newCount
        });
    } catch (error) {
        console.error('Join complaint error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── CITIZEN: Submit Complaint ────────────────────────────────────────────────

/**
 * POST /api/complaints
 */
const submitComplaint = async (req, res) => {
    const { title, description, problem_type, location, priority,
            complaint_district, complaint_area } = req.body;
    const userId = req.user.id;

    // Validation
    if (!title || !description || !problem_type || !location) {
        return res.status(400).json({ success: false, message: 'Title, description, problem type, and location are required.' });
    }
    if (!complaint_district || !complaint_area) {
        return res.status(400).json({ success: false, message: 'Please select the district and area for the complaint.' });
    }
    if (!PROBLEM_TYPES.includes(problem_type)) {
        return res.status(400).json({ success: false, message: 'Invalid problem type.' });
    }

    const imagePath = req.file ? req.file.filename : null;

    // Route to the selected city and area — enables cross-municipality reporting
    const city = complaint_district;
    const ward = complaint_area;

    try {
        // ── Same-user duplicate prevention (server-side safeguard) ──
        const [ownActive] = await pool.query(
            `SELECT id FROM complaints
             WHERE user_id = ? AND city = ? AND ward = ? AND problem_type = ?
             AND status NOT IN ('Solved', 'Rejected')
             LIMIT 1`,
            [userId, city, ward, problem_type]
        );

        if (ownActive.length > 0) {
            // Clean up uploaded file since we're rejecting
            if (imagePath) {
                const filePath = path.join(__dirname, '../uploads', imagePath);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            return res.status(400).json({
                success: false,
                message: 'You have already reported or joined this complaint previously.',
                existingComplaintId: ownActive[0].id
            });
        }

        const [joinedActive] = await pool.query(
            `SELECT c.id FROM complaints c
             INNER JOIN complaint_supporters cs ON c.id = cs.complaint_id
             WHERE cs.user_id = ? AND c.city = ? AND c.ward = ? AND c.problem_type = ?
             AND c.status NOT IN ('Solved', 'Rejected')
             LIMIT 1`,
            [userId, city, ward, problem_type]
        );

        if (joinedActive.length > 0) {
            if (imagePath) {
                const filePath = path.join(__dirname, '../uploads', imagePath);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            return res.status(400).json({
                success: false,
                message: 'You have already joined this complaint previously.',
                existingComplaintId: joinedActive[0].id
            });
        }
        // Generate share token
        const shareToken = uuidv4().replace(/-/g, '');

        const [result] = await pool.query(
            `INSERT INTO complaints
             (user_id, title, description, problem_type, location, ward, city, priority, status, image_path, share_token)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?)`,
            [userId, title.trim(), description.trim(), problem_type, location.trim(),
             ward, city, priority || 'Medium', imagePath, shareToken]
        );

        const complaintId = result.insertId;

        // Notification: Submission — include area and municipality for clarity
        await pool.query(
            'INSERT INTO notifications (user_id, complaint_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
            [userId, complaintId, 'complaint_submitted',
             'Complaint Submitted Successfully',
             `Your complaint "${title}" has been submitted to ${city} municipality (${ward} area) and is being reviewed. Complaint ID: #${complaintId}`]
        );

        res.status(201).json({
            success: true,
            message: 'Complaint submitted successfully!',
            complaintId,
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


// ─── CITIZEN: Get My Complaints (includes joined complaints) ──────────────────

/**
 * GET /api/complaints/my
 */
const getMyComplaints = async (req, res) => {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    try {
        // Get own complaints
        let ownQuery = 'SELECT *, 0 as is_joined FROM complaints WHERE user_id = ?';
        const ownParams = [userId];

        if (status) {
            ownQuery += ' AND status = ?';
            ownParams.push(status);
        }

        // Get joined complaints
        let joinedQuery = `
            SELECT c.*, 1 as is_joined
            FROM complaints c
            INNER JOIN complaint_supporters cs ON c.id = cs.complaint_id
            WHERE cs.user_id = ?`;
        const joinedParams = [userId];

        if (status) {
            joinedQuery += ' AND c.status = ?';
            joinedParams.push(status);
        }

        // Combine both queries using UNION
        const combinedQuery = `(${ownQuery}) UNION (${joinedQuery}) ORDER BY created_at DESC`;
        const combinedParams = [...ownParams, ...joinedParams];

        const [allComplaints] = await pool.query(combinedQuery, combinedParams);
        const total = allComplaints.length;

        // Paginate
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const paginated = allComplaints.slice(offset, offset + parseInt(limit));

        // Alias ward as area for frontend consistency
        paginated.forEach(c => { c.area = c.ward; });

        res.json({
            success: true,
            complaints: paginated,
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
 * Returns complaint if user is the owner OR a supporter.
 */
const getComplaint = async (req, res) => {
    const userId = req.user.id;
    const complaintId = req.params.id;

    try {
        // Check if user is owner
        const [ownRows] = await pool.query(
            'SELECT *, 0 as is_joined FROM complaints WHERE id = ? AND user_id = ?',
            [complaintId, userId]
        );

        if (ownRows.length > 0) {
            const complaint = ownRows[0];
            complaint.area = complaint.ward;

            // Get supporters list
            const [supporters] = await pool.query(
                `SELECT u.username, cs.joined_at
                 FROM complaint_supporters cs
                 JOIN users u ON cs.user_id = u.id
                 WHERE cs.complaint_id = ?
                 ORDER BY cs.joined_at DESC`,
                [complaintId]
            );

            return res.json({ success: true, complaint, supporters });
        }

        // Check if user is a supporter
        const [joinedRows] = await pool.query(
            `SELECT c.*, 1 as is_joined
             FROM complaints c
             INNER JOIN complaint_supporters cs ON c.id = cs.complaint_id
             WHERE c.id = ? AND cs.user_id = ?`,
            [complaintId, userId]
        );

        if (joinedRows.length > 0) {
            const complaint = joinedRows[0];
            complaint.area = complaint.ward;
            return res.json({ success: true, complaint, supporters: [] });
        }

        return res.status(404).json({ success: false, message: 'Complaint not found.' });
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

        // Only allow deleting active (non-solved) complaints
        if (complaint.status === 'Solved') {
            return res.status(400).json({ success: false, message: 'Use the acknowledge button to remove solved complaints.' });
        }

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

// ─── CITIZEN: Leave Joined Complaint ─────────────────────────────────────────

/**
 * POST /api/complaints/:id/leave
 * Remove user from a complaint they previously joined.
 */
const leaveComplaint = async (req, res) => {
    const userId = req.user.id;
    const complaintId = req.params.id;

    try {
        // Check complaint status first
        const [complaint] = await pool.query(
            'SELECT status FROM complaints WHERE id = ?', [complaintId]
        );
        if (complaint.length > 0 && ['Solved', 'Rejected'].includes(complaint[0].status)) {
            return res.status(400).json({ success: false, message: 'This complaint is closed. No modifications allowed.' });
        }

        const [existing] = await pool.query(
            'SELECT id FROM complaint_supporters WHERE complaint_id = ? AND user_id = ?',
            [complaintId, userId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'You have not joined this complaint.' });
        }

        await pool.query(
            'DELETE FROM complaint_supporters WHERE complaint_id = ? AND user_id = ?',
            [complaintId, userId]
        );

        await pool.query(
            'UPDATE complaints SET supporter_count = GREATEST(supporter_count - 1, 0) WHERE id = ?',
            [complaintId]
        );

        res.json({ success: true, message: 'You have left this complaint.' });
    } catch (error) {
        console.error('Leave complaint error:', error);
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
                    c.priority, c.status, c.image_path, c.attempt_count, c.supporter_count,
                    c.created_at, c.updated_at,
                    u.username as citizen_name
             FROM complaints c JOIN users u ON c.user_id = u.id
             WHERE c.share_token = ?`,
            [token]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Shared complaint not found.' });
        }

        const complaint = rows[0];
        complaint.area = complaint.ward;
        res.json({ success: true, complaint });
    } catch (error) {
        console.error('Shared complaint error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─── CITIZEN: Acknowledge Solved Complaint ────────────────────────────────────

/**
 * POST /api/complaints/:id/acknowledge
 * Citizen confirms they've seen the resolved complaint.
 * - Owner: deletes the complaint entirely (image + DB record)
 * - Supporter: removes their supporter link only
 * Once all supporters have acknowledged AND the owner acknowledges, the complaint is gone.
 */
const acknowledgeComplaint = async (req, res) => {
    const userId = req.user.id;
    const complaintId = req.params.id;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM complaints WHERE id = ?',
            [complaintId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        }

        const complaint = rows[0];

        if (complaint.status !== 'Solved') {
            return res.status(400).json({ success: false, message: 'Only solved complaints can be acknowledged.' });
        }

        // Check if user is a supporter
        const [supporter] = await pool.query(
            'SELECT id FROM complaint_supporters WHERE complaint_id = ? AND user_id = ?',
            [complaintId, userId]
        );

        if (supporter.length > 0) {
            // Supporter: remove their link
            await pool.query(
                'DELETE FROM complaint_supporters WHERE complaint_id = ? AND user_id = ?',
                [complaintId, userId]
            );
            await pool.query(
                'UPDATE complaints SET supporter_count = GREATEST(supporter_count - 1, 0) WHERE id = ?',
                [complaintId]
            );
            return res.json({ success: true, message: 'Complaint acknowledged and removed from your dashboard.' });
        }

        // Check if user is the owner
        if (complaint.user_id === userId) {
            // Delete image file if exists
            if (complaint.image_path) {
                const filePath = path.join(__dirname, '../uploads', complaint.image_path);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            // Delete the complaint (CASCADE removes supporters + notifications)
            await pool.query('DELETE FROM complaints WHERE id = ?', [complaintId]);
            return res.json({ success: true, message: 'Complaint acknowledged and permanently removed.' });
        }

        return res.status(403).json({ success: false, message: 'You are not associated with this complaint.' });
    } catch (error) {
        console.error('Acknowledge complaint error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = {
    submitComplaint, getMyComplaints, getComplaint,
    deleteComplaint, reattemptComplaint, getSharedComplaint,
    checkMatchingComplaint, joinComplaint, leaveComplaint,
    acknowledgeComplaint
};
