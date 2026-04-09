const express = require('express');
const { login, refresh, logout, getMe } = require('./authController');
const { protect } = require('../../middlewares/auth');

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
