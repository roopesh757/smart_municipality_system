// routes/complaintRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, citizenOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
    submitComplaint, getMyComplaints, getComplaint,
    deleteComplaint, reattemptComplaint, getSharedComplaint
} = require('../controllers/complaintController');

// Public route - shared complaint view
router.get('/share/:token', getSharedComplaint);

// Protected citizen routes
router.post('/', verifyToken, citizenOnly, upload.single('image'), submitComplaint);
router.get('/my', verifyToken, citizenOnly, getMyComplaints);
router.get('/:id', verifyToken, citizenOnly, getComplaint);
router.delete('/:id', verifyToken, citizenOnly, deleteComplaint);
router.post('/:id/reattempt', verifyToken, citizenOnly, reattemptComplaint);

module.exports = router;
