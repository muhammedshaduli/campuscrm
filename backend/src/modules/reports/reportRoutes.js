const express = require('express');
const { protect } = require('../../middlewares/auth');
const { getCounselorLeaderboard, getCourseTrends } = require('./reportController');

const router = express.Router();

router.use(protect);

router.get('/counselor-leaderboard', getCounselorLeaderboard);
router.get('/course-trends', getCourseTrends);

module.exports = router;
