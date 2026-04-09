const express = require('express');
const authRoutes = require('../modules/auth/authRoutes');
const leadRoutes = require('../modules/leads/leadRoutes');
const masterRoutes = require('../modules/masters/masterRoutes');
const followupRoutes = require('../modules/followups/followupRoutes');
const dashboardRoutes = require('../modules/dashboard/dashboardRoutes');
const financeRoutes = require('../modules/finance/financeRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/masters', masterRoutes);
router.use('/followups', followupRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/finance', financeRoutes);
router.use('/users', require('../modules/users/userRoutes'));

module.exports = router;
