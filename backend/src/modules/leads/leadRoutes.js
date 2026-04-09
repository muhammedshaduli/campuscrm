const express = require('express');
const { createLead, getLeads, updateLead, getLeadById } = require('./leadController');
const { protect, restrictTo } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('ADMIN', 'COUNSELLOR'), createLead);
router.get('/', getLeads);
router.get('/:id', getLeadById);
router.patch('/:id', restrictTo('ADMIN', 'COUNSELLOR'), updateLead);

module.exports = router;
