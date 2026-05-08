// controllers/authController.js - Authentication Logic
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

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
    const { username, email, password, mobile, city, ward } = req.body;

    // Validation
    if (!username || !email || !password || !mobile || !city || !ward) {
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

        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, mobile, city, ward) VALUES (?, ?, ?, ?, ?, ?)',
            [username.trim(), email.toLowerCase(), hashedPassword, mobile, city.trim(), ward.trim()]
        );

        const userId = result.insertId;

        // Create welcome notification
        await pool.query(
            'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
            [userId, 'registration', 'Welcome to Municipality Portal!',
             `Hello ${username}! Your account has been created successfully. You can now report civic issues in your area.`]
        );

        // Generate token
        const token = generateToken({ id: userId, email: email.toLowerCase(), role: 'citizen', city });

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            token,
            user: { id: userId, username, email: email.toLowerCase(), city, ward, role: 'citizen' }
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
            user: { id: user.id, username: user.username, email: user.email, city: user.city, ward: user.ward, role: 'citizen' }
        });
    } catch (error) {
        console.error('Citizen login error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

// ─── ADMIN AUTH ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/admin/register
 */
const adminRegister = async (req, res) => {
    const { username, email, password, city } = req.body;

    if (!username || !email || !password || !city) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    try {
        const [existing] = await pool.query('SELECT id FROM admins WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO admins (username, email, password, city) VALUES (?, ?, ?, ?)',
            [username.trim(), email.toLowerCase(), hashedPassword, city.trim()]
        );

        const token = generateToken({ id: result.insertId, email: email.toLowerCase(), role: 'admin', city });

        res.status(201).json({
            success: true,
            message: 'Admin registration successful!',
            token,
            user: { id: result.insertId, username, email: email.toLowerCase(), city, role: 'admin' }
        });
    } catch (error) {
        console.error('Admin register error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

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
                'SELECT id, username, email, mobile, city, ward, role, created_at FROM users WHERE id = ?',
                [req.user.id]
            );
            userData = rows[0];
        } else {
            const [rows] = await pool.query(
                'SELECT id, username, email, city, role, created_at FROM admins WHERE id = ?',
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

module.exports = { citizenRegister, citizenLogin, adminRegister, adminLogin, getMe, deleteMyAccount };
