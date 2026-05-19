// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken, adminOnly } = require('../middleware/auth');
const {
    getDashboardStats, getAllComplaints, updateComplaintStatus,
    getCityUsers, getComplaintDetail, getHighImpactComplaints, deleteUser
} = require('../controllers/adminController');

router.use(verifyToken, adminOnly);

router.get('/dashboard', getDashboardStats);
router.get('/complaints', getAllComplaints);
router.get('/complaints/:id', getComplaintDetail);
router.put('/complaints/:id/status', updateComplaintStatus);
router.get('/users', getCityUsers);
router.delete('/users/:id', deleteUser);
router.get('/high-impact', getHighImpactComplaints);

module.exports = router;
