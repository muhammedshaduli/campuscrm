const express = require('express');
const {
  getDashboardStats,
  getSourceSummary,
  getRecentActivity,
  getDashboardOverview,
} = require('./dashboardController');
const { protect } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/overview', getDashboardOverview);
router.get('/stats', getDashboardStats);
router.get('/source-summary', getSourceSummary);
router.get('/recent-activity', getRecentActivity);

module.exports = router;
