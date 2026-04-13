const express = require('express');
const { createLead, getLeads, updateLead, getLeadById } = require('./leadController');
const { protect, restrictTo } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES'), createLead);
router.get('/', getLeads);
router.get('/:id', getLeadById);
router.patch('/:id', restrictTo('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES'), updateLead);

module.exports = router;
