// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { citizenRegister, citizenLogin, adminRegister, adminLogin, getMe } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/citizen/register', citizenRegister);
router.post('/citizen/login', citizenLogin);
router.post('/admin/register', adminRegister);
router.post('/admin/login', adminLogin);
router.get('/me', verifyToken, getMe);

module.exports = router;
