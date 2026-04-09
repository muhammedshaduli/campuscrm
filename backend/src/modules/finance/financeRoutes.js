const express = require('express');
const { createInvoice, getInvoices, recordPayment } = require('./financeController');
const { protect, restrictTo } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/invoices', restrictTo('ADMIN', 'SUPER_ADMIN'), createInvoice);
router.get('/invoices', getInvoices);
router.post('/payments', restrictTo('ADMIN', 'SUPER_ADMIN'), recordPayment);

module.exports = router;
