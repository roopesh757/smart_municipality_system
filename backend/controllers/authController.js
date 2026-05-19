// controllers/authController.js - Authentication Logic
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

/**
 * Validate email format
 */
const isValidEmail = (email) => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
};

/**
 * Validate password strength
 */
const isValidPassword = (password) => {
    return password && password.length >= 6;
};

/**
 * Generate JWT token
 */
const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

// ─── CITIZEN AUTH ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/citizen/register
 */
const citizenRegister = async (req, res) => {
    const { username, email, password, mobile, state, district, taluk, area } = req.body;

    // Validation
    if (!username || !email || !password || !mobile || !state || !district || !area) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
        return res.status(400).json({ success: false, message: 'Mobile must be a 10-digit number.' });
    }

    try {
        // Check if email exists
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already registered.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user (city = selected municipality, ward = selected area)
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, mobile, state, district, taluk, area, city, ward) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [username.trim(), email.toLowerCase(), hashedPassword, mobile, state.trim(), district.trim(), '', area.trim(), district.trim(), area.trim()]
        );

        const userId = result.insertId;

        // Create welcome notification
        await pool.query(
            'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
            [userId, 'registration', 'Welcome to Municipality Portal!',
             `Hello ${username}! Your account has been created successfully. You can now report civic issues in your area.`]
        );

        // Generate token
        const token = generateToken({ id: userId, email: email.toLowerCase(), role: 'citizen', city: district });

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            token,
            user: { id: userId, username, email: email.toLowerCase(), state, city: district, area, role: 'citizen' }
        });
    } catch (error) {
        console.error('Citizen register error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

/**
 * POST /api/auth/citizen/login
 */
const citizenLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email.toLowerCase()]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const token = generateToken({ id: user.id, email: user.email, role: 'citizen', city: user.city });

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: { id: user.id, username: user.username, email: user.email, state: user.state, city: user.city, area: user.area, role: 'citizen' }
        });
    } catch (error) {
        console.error('Citizen login error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

// ─── ADMIN AUTH ──────────────────────────────────────────────────────────────
// NOTE: Admin accounts are created directly via SQL INSERT.
// No public registration endpoint exists for admins.

/**
 * POST /api/auth/admin/login
 */
const adminLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    try {
        const [admins] = await pool.query('SELECT * FROM admins WHERE email = ? AND is_active = 1', [email.toLowerCase()]);
        if (admins.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const admin = admins[0];
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const token = generateToken({ id: admin.id, email: admin.email, role: admin.role, city: admin.city });

        res.json({
            success: true,
            message: 'Admin login successful!',
            token,
            user: { id: admin.id, username: admin.username, email: admin.email, city: admin.city, role: admin.role }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

/**
 * GET /api/auth/me - Get current user profile
 */
const getMe = async (req, res) => {
    try {
        let userData;
        if (req.user.role === 'citizen') {
            const [rows] = await pool.query(
                'SELECT id, username, email, mobile, state, city, area, role, profile_photo, created_at FROM users WHERE id = ?',
                [req.user.id]
            );
            userData = rows[0];
        } else {
            const [rows] = await pool.query(
                'SELECT id, username, email, mobile, city, role, profile_photo, created_at FROM admins WHERE id = ?',
                [req.user.id]
            );
            userData = rows[0];
        }

        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/**
 * DELETE /api/auth/me - Delete own account (citizen only)
 * Requires password confirmation
 */
const deleteMyAccount = async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ success: false, message: 'Password is required to confirm account deletion.' });
    }

    if (req.user.role !== 'citizen') {
        return res.status(403).json({ success: false, message: 'Only citizens can delete their own account from here.' });
    }

    try {
        // Fetch user to verify password
        const [users] = await pool.query('SELECT * FROM users WHERE id = ? AND is_active = 1', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(403).json({ success: false, message: 'Incorrect password. Please enter your correct password.' });
        }

        // Delete user — CASCADE will remove complaints and notifications automatically
        await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]);

        res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

// ─── PROFILE MANAGEMENT ─────────────────────────────────────────────────────

/**
 * PUT /api/auth/profile - Update profile details (name, mobile)
 */
const updateProfile = async (req, res) => {
    const { username, mobile } = req.body;

    if (!username || !username.trim()) {
        return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (mobile && !/^[0-9]{10}$/.test(mobile)) {
        return res.status(400).json({ success: false, message: 'Mobile must be a 10-digit number.' });
    }

    try {
        const table = req.user.role === 'citizen' ? 'users' : 'admins';
        await pool.query(
            `UPDATE ${table} SET username = ?, mobile = ? WHERE id = ?`,
            [username.trim(), mobile || null, req.user.id]
        );

        // Return updated user data
        const selectCols = req.user.role === 'citizen'
            ? 'id, username, email, mobile, state, city, area, role, profile_photo'
            : 'id, username, email, mobile, city, role, profile_photo';
        const [rows] = await pool.query(`SELECT ${selectCols} FROM ${table} WHERE id = ?`, [req.user.id]);

        res.json({ success: true, message: 'Profile updated successfully.', user: rows[0] });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/**
 * PUT /api/auth/password - Change password
 */
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    }
    if (!isValidPassword(newPassword)) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    try {
        const table = req.user.role === 'citizen' ? 'users' : 'admins';
        const [rows] = await pool.query(`SELECT password FROM ${table} WHERE id = ?`, [req.user.id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
        if (!isMatch) {
            return res.status(403).json({ success: false, message: 'Current password is incorrect.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(`UPDATE ${table} SET password = ? WHERE id = ?`, [hashedPassword, req.user.id]);

        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/**
 * POST /api/auth/profile-photo - Upload/update profile photo
 */
const uploadProfilePhoto = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No photo file uploaded.' });
    }

    try {
        const table = req.user.role === 'citizen' ? 'users' : 'admins';

        // Delete old photo if exists
        const [existing] = await pool.query(`SELECT profile_photo FROM ${table} WHERE id = ?`, [req.user.id]);
        if (existing[0]?.profile_photo) {
            const oldPath = path.join(__dirname, '../uploads', existing[0].profile_photo);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await pool.query(`UPDATE ${table} SET profile_photo = ? WHERE id = ?`, [req.file.filename, req.user.id]);

        res.json({ success: true, message: 'Profile photo updated.', profile_photo: req.file.filename });
    } catch (error) {
        console.error('Upload profile photo error:', error);
        // Clean up uploaded file on error
        if (req.file) {
            const filePath = path.join(__dirname, '../uploads', req.file.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = {
    citizenRegister, citizenLogin, adminLogin, getMe, deleteMyAccount,
    updateProfile, changePassword, uploadProfilePhoto
};
