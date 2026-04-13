const prisma = require('../../config/db');
const { sendResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middlewares/error');

/**
 * @desc    Get dashboard KPI summaries
 * @route   GET /api/dashboard/stats
 * @access  Private
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const where = req.user.role === 'SALES' ? { assignedCounsellorId: req.user.id } : {};
  const today = new Date();
  today.setHours(0,0,0,0);

  const [
    totalLeads,
    todayLeads,
    admissionConfirmed,
    todayNotAttended,
    newEnquiry,
    counseling,
    interested,
    notInterested,
    pendingInvoices
  ] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ 
      where: { ...where, createdAt: { gte: today } } 
    }),
    prisma.lead.count({ 
      where: { ...where, status: 'ADMISSION_CONFIRMED' } 
    }),
    prisma.lead.count({ 
      where: { ...where, notAttended: true, lastCallDate: { gte: today } } 
    }),
    prisma.lead.count({ 
      where: { ...where, status: 'NEW_ENQUIRY' } 
    }),
    prisma.lead.count({ 
      where: { ...where, status: 'COUNSELING' } 
    }),
    prisma.lead.count({ 
      where: { ...where, status: 'INTERESTED' } 
    }),
    prisma.lead.count({ 
      where: { ...where, status: 'NOT_INTERESTED' } 
    }),
    prisma.invoice.count({
      where: {
        status: {
          not: 'Paid',
        },
      },
    })
  ]);

  sendResponse(res, 200, 'Dashboard stats fetched successfully', {
    totalLeads,
    todayLeads,
    confirmedAdmissions: admissionConfirmed,
    notAttendedToday: todayNotAttended,
    newEnquiries: newEnquiry,
    counseling,
    inCounseling: counseling,
    interested,
    notInterested,
    pendingInvoices,
  });
});

/**
 * @desc    Get lead source distribution for charts/panels
 * @route   GET /api/dashboard/source-summary
 * @access  Private
 */
const getSourceSummary = asyncHandler(async (req, res) => {
  const where = req.user.role === 'SALES' ? { assignedCounsellorId: req.user.id } : {};
  
  const summary = await prisma.lead.groupBy({
    by: ['source'],
    _count: { source: true },
    where
  });

  sendResponse(
    res,
    200,
    'Source summary fetched',
    summary.map((item) => ({
      source: item.source,
      _count: item._count.source,
    }))
  );
});

/**
 * @desc    Get recent activity feed
 * @route   GET /api/dashboard/recent-activity
 * @access  Private
 */
const getRecentActivity = asyncHandler(async (req, res) => {
  const where =
    req.user.role === 'SALES'
      ? {
          OR: [
            { userId: req.user.id },
            { lead: { assignedCounsellorId: req.user.id } },
          ],
        }
      : {};

  const activities = await prisma.activity.findMany({
    where,
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { fullName: true } },
      lead: { select: { id: true, studentName: true, leadCode: true } },
    },
  });
  
  sendResponse(
    res,
    200,
    'Recent activity fetched',
    activities.map((activity) => ({
      id: activity.id,
      action: activity.type,
      notes: activity.message,
      lead: activity.lead,
      user: activity.user,
      createdAt: activity.createdAt,
    }))
  );
});

module.exports = {
  getDashboardStats,
  getSourceSummary,
  getRecentActivity,
};
