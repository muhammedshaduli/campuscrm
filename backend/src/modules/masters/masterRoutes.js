const express = require('express');
const { getStates, getDistricts, getColleges, getCourses, getCounselors } = require('./masterController');
const { protect } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/states', getStates);
router.get('/districts/:stateId', getDistricts);
router.get('/colleges', getColleges);
router.get('/courses', getCourses);
router.get('/counselors', getCounselors);

module.exports = router;
