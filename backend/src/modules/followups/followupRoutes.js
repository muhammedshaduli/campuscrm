const express = require('express');
const { addFollowup, getLeadFollowups } = require('./followupController');
const { protect } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/', addFollowup);
router.get('/lead/:leadId', getLeadFollowups);

module.exports = router;
