const prisma = require('../../config/db');
const { sendResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middlewares/error');

const getLeadVisibilityFilter = (user) => {
  if (user.role === 'SALES') {
    return { assignedCounsellorId: user.id };
  }

  return {};
};

/**
 * @desc    Get counselor leaderboard based on assigned leads
 * @route   GET /api/reports/counselor-leaderboard
 * @access  Private
 */
const getCounselorLeaderboard = asyncHandler(async (req, res) => {
  const groupedLeads = await prisma.lead.groupBy({
    by: ['assignedCounsellorId'],
    where: {
      ...getLeadVisibilityFilter(req.user),
      assignedCounsellorId: {
        not: null,
      },
    },
    _count: {
      _all: true,
    },
  });

  const counselorIds = groupedLeads
    .map((item) => item.assignedCounsellorId)
    .filter(Boolean);

  const counselors = counselorIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: counselorIds,
          },
        },
        select: {
          id: true,
          fullName: true,
        },
      })
    : [];

  const counselorMap = new Map(counselors.map((user) => [user.id, user.fullName]));

  const leaderboard = groupedLeads
    .map((item) => ({
      fullName: counselorMap.get(item.assignedCounsellorId) || 'Unassigned',
      _count: {
        leads: item._count._all,
      },
    }))
    .sort((left, right) => right._count.leads - left._count.leads)
    .slice(0, 10);

  sendResponse(res, 200, 'Counselor leaderboard fetched successfully', leaderboard);
});

/**
 * @desc    Get course trends based on lead volume
 * @route   GET /api/reports/course-trends
 * @access  Private
 */
const getCourseTrends = asyncHandler(async (req, res) => {
  const groupedLeads = await prisma.lead.groupBy({
    by: ['preferredCourseId'],
    where: {
      ...getLeadVisibilityFilter(req.user),
      preferredCourseId: {
        not: null,
      },
    },
    _count: {
      _all: true,
    },
  });

  const courseIds = groupedLeads
    .map((item) => item.preferredCourseId)
    .filter(Boolean);

  const courses = courseIds.length
    ? await prisma.course.findMany({
        where: {
          id: {
            in: courseIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  const courseMap = new Map(courses.map((course) => [course.id, course.name]));

  const courseTrends = groupedLeads
    .map((item) => ({
      name: courseMap.get(item.preferredCourseId) || 'Unassigned Course',
      _count: {
        leads: item._count._all,
      },
    }))
    .sort((left, right) => right._count.leads - left._count.leads)
    .slice(0, 10);

  sendResponse(res, 200, 'Course trends fetched successfully', courseTrends);
});

module.exports = {
  getCounselorLeaderboard,
  getCourseTrends,
};
