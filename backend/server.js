// server.js - Main Express Application Entry Point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const seedDefaults = require('./config/seed');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://localhost:5500',   // VS Code Live Server
        'http://127.0.0.1:5500',
        'http://localhost:5000',
        'null'                     // file:// protocol for local HTML
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Municipality API is running!', timestamp: new Date() });
});

// ─── Serve Frontend HTML ──────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Max 5MB allowed.' });
    }
    if (err.message && err.message.includes('Only image files')) {
        return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Something went wrong.' });
});

app.listen(PORT, () => {
    console.log(`\n🏛️  Smart Municipality API running on http://localhost:${PORT}`);
    console.log(`📋 Frontend at: http://localhost:${PORT}`);
    console.log(`🔑 API Base: http://localhost:${PORT}/api\n`);

    // Auto-seed default admin accounts
    seedDefaults();
});
