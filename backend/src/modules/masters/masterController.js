const prisma = require('../../config/db');
const { sendResponse, ApiError } = require('../../utils/response');
const { asyncHandler } = require('../../middlewares/error');

/**
 * @desc    Get all states
 * @route   GET /api/masters/states
 * @access  Private
 */
const getStates = asyncHandler(async (req, res) => {
  const states = await prisma.state.findMany({ include: { districts: true } });
  sendResponse(res, 200, 'States fetched successfully', states);
});

/**
 * @desc    Get all districts by state
 * @route   GET /api/masters/districts/:stateId
 * @access  Private
 */
const getDistricts = asyncHandler(async (req, res) => {
  const districts = await prisma.district.findMany({
    where: { stateId: parseInt(req.params.stateId) }
  });
  sendResponse(res, 200, 'Districts fetched successfully', districts);
});

/**
 * @desc    Get all colleges
 * @route   GET /api/masters/colleges
 * @access  Private
 */
const getColleges = asyncHandler(async (req, res) => {
  const { stateId, districtId } = req.query;
  const where = { isActive: true };
  if (stateId) where.stateId = parseInt(stateId);
  if (districtId) where.districtId = parseInt(districtId);

  const colleges = await prisma.college.findMany({
    where,
    include: { state: true, district: true }
  });
  sendResponse(res, 200, 'Colleges fetched successfully', colleges);
});

/**
 * @desc    Get all courses
 * @route   GET /api/masters/courses
 * @access  Private
 */
const getCourses = asyncHandler(async (req, res) => {
  const courses = await prisma.course.findMany({ where: { isActive: true } });
  sendResponse(res, 200, 'Courses fetched successfully', courses);
});

module.exports = {
  getStates,
  getDistricts,
  getColleges,
  getCourses,
};
