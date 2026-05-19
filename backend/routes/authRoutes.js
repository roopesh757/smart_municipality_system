// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
    citizenRegister, citizenLogin, adminLogin, getMe, deleteMyAccount,
    updateProfile, changePassword, uploadProfilePhoto
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { profileUpload } = require('../middleware/upload');

router.post('/citizen/register', citizenRegister);
router.post('/citizen/login', citizenLogin);

router.post('/admin/login', adminLogin);
router.get('/me', verifyToken, getMe);
router.delete('/me', verifyToken, deleteMyAccount);

// Profile management
router.put('/profile', verifyToken, updateProfile);
router.put('/password', verifyToken, changePassword);
router.post('/profile-photo', verifyToken, profileUpload.single('photo'), uploadProfilePhoto);

module.exports = router;
