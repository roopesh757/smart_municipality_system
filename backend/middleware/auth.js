// middleware/auth.js - JWT Authentication Middleware
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Verify JWT token from Authorization header
 */
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token has expired. Please login again.' });
        }
        return res.status(403).json({ success: false, message: 'Invalid token.' });
    }
};

/**
 * Citizen-only route guard
 */
const citizenOnly = (req, res, next) => {
    if (req.user.role !== 'citizen') {
        return res.status(403).json({ success: false, message: 'Access denied. Citizens only.' });
    }
    next();
};

/**
 * Admin-only route guard
 */
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }
    next();
};

module.exports = { verifyToken, citizenOnly, adminOnly };
