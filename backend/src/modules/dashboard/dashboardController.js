const prisma = require('../../config/db');
const { sendResponse } = require('../../utils/response');
const { asyncHandler } = require('../../middlewares/error');

const PIPELINE_STAGE_CONFIG = [
  { status: 'NEW_ENQUIRY', label: 'New Enquiry', tone: 'navy' },
  { status: 'COUNSELING', label: 'Counseling', tone: 'indigo' },
  { status: 'INTERESTED', label: 'Interested', tone: 'cyan' },
  { status: 'NOT_ATTENDED', label: 'Not Attended', tone: 'rose' },
  { status: 'NOT_INTERESTED', label: 'Not Interested', tone: 'slate' },
  { status: 'ADMISSION_CONFIRMED', label: 'Admission Confirmed', tone: 'emerald' },
];

const getLeadVisibilityFilter = (user) => (
  user.role === 'SALES' ? { assignedCounsellorId: user.id } : {}
);

const getRecentActivityFilter = (user) => (
  user.role === 'SALES'
    ? {
        OR: [
          { userId: user.id },
          { lead: { assignedCounsellorId: user.id } },
        ],
      }
    : {}
);

async function buildDashboardStats(user) {
  const where = getLeadVisibilityFilter(user);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalLeads,
    todayLeads,
    admissionConfirmed,
    todayNotAttended,
    newEnquiry,
    counseling,
    interested,
    notInterested,
    pendingInvoices,
  ] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({
      where: { ...where, createdAt: { gte: today } },
    }),
    prisma.lead.count({
      where: { ...where, status: 'ADMISSION_CONFIRMED' },
    }),
    prisma.lead.count({
      where: { ...where, notAttended: true, lastCallDate: { gte: today } },
    }),
    prisma.lead.count({
      where: { ...where, status: 'NEW_ENQUIRY' },
    }),
    prisma.lead.count({
      where: { ...where, status: 'COUNSELING' },
    }),
    prisma.lead.count({
      where: { ...where, status: 'INTERESTED' },
    }),
    prisma.lead.count({
      where: { ...where, status: 'NOT_INTERESTED' },
    }),
    prisma.invoice.count({
      where: {
        status: {
          not: 'Paid',
        },
      },
    }),
  ]);

  return {
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
  };
}

async function buildSourceSummary(user) {
  const summary = await prisma.lead.groupBy({
    by: ['source'],
    _count: { source: true },
    where: getLeadVisibilityFilter(user),
  });

  return summary.map((item) => ({
    source: item.source,
    _count: item._count.source,
  }));
}

async function buildRecentActivity(user) {
  const activities = await prisma.activity.findMany({
    where: getRecentActivityFilter(user),
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { fullName: true } },
      lead: { select: { id: true, studentName: true, leadCode: true } },
    },
  });

  return activities.map((activity) => ({
    id: activity.id,
    action: activity.type,
    notes: activity.message,
    lead: activity.lead,
    user: activity.user,
    createdAt: activity.createdAt,
  }));
}

async function buildPipelineSummary(user) {
  const grouped = await prisma.lead.groupBy({
    by: ['status'],
    _count: { status: true },
    where: getLeadVisibilityFilter(user),
  });

  const countMap = new Map(
    grouped.map((item) => [item.status, item._count.status || 0])
  );

  return PIPELINE_STAGE_CONFIG.map((stage) => ({
    ...stage,
    count: countMap.get(stage.status) || 0,
  }));
}

async function buildRecentInquiries(user) {
  return prisma.lead.findMany({
    where: getLeadVisibilityFilter(user),
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      state: true,
      preferredCourse: true,
      assignedCounsellor: { select: { id: true, fullName: true } },
    },
  });
}

async function buildUpcomingReminders(user) {
  const reminders = await prisma.reminder.findMany({
    where: {
      isCompleted: false,
      ...(user.role === 'SALES' ? { assignedTo: user.id } : {}),
    },
    take: 5,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      lead: {
        select: {
          id: true,
          studentName: true,
          phone: true,
          leadCode: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  return reminders.map((reminder) => ({
    id: reminder.id,
    title: reminder.title,
    description: reminder.description,
    dueDate: reminder.dueDate,
    priority: reminder.priority,
    isCompleted: reminder.isCompleted,
    lead: reminder.lead,
    assignedUser: reminder.user,
  }));
}

async function buildCounselorPerformance(user) {
  const groupedLeads = await prisma.lead.groupBy({
    by: ['assignedCounsellorId'],
    where: {
      ...getLeadVisibilityFilter(user),
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

  const counselorMap = new Map(counselors.map((item) => [item.id, item.fullName]));

  return groupedLeads
    .map((item) => ({
      id: item.assignedCounsellorId,
      fullName: counselorMap.get(item.assignedCounsellorId) || 'Unassigned',
      leadCount: item._count._all,
    }))
    .sort((left, right) => right.leadCount - left.leadCount)
    .slice(0, 5);
}

async function buildTopStates(user) {
  const groupedStates = await prisma.lead.groupBy({
    by: ['stateId'],
    where: {
      ...getLeadVisibilityFilter(user),
      stateId: {
        not: null,
      },
    },
    _count: {
      _all: true,
    },
  });

  const stateIds = groupedStates
    .map((item) => item.stateId)
    .filter((value) => value !== null);

  const states = stateIds.length
    ? await prisma.state.findMany({
        where: {
          id: {
            in: stateIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  const stateMap = new Map(states.map((item) => [item.id, item.name]));

  return groupedStates
    .map((item) => ({
      id: item.stateId,
      name: stateMap.get(item.stateId) || 'Unknown State',
      leadCount: item._count._all,
    }))
    .sort((left, right) => right.leadCount - left.leadCount)
    .slice(0, 5);
}

const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await buildDashboardStats(req.user);
  sendResponse(res, 200, 'Dashboard stats fetched successfully', stats);
});

const getSourceSummary = asyncHandler(async (req, res) => {
  const summary = await buildSourceSummary(req.user);
  sendResponse(res, 200, 'Source summary fetched', summary);
});

const getRecentActivity = asyncHandler(async (req, res) => {
  const activities = await buildRecentActivity(req.user);
  sendResponse(res, 200, 'Recent activity fetched', activities);
});

const getDashboardOverview = asyncHandler(async (req, res) => {
  const [
    stats,
    sourceSummary,
    recentActivity,
    pipeline,
    recentInquiries,
    reminders,
    counselorPerformance,
    topStates,
  ] = await Promise.all([
    buildDashboardStats(req.user),
    buildSourceSummary(req.user),
    buildRecentActivity(req.user),
    buildPipelineSummary(req.user),
    buildRecentInquiries(req.user),
    buildUpcomingReminders(req.user),
    buildCounselorPerformance(req.user),
    buildTopStates(req.user),
  ]);

  sendResponse(res, 200, 'Dashboard overview fetched successfully', {
    stats,
    sourceSummary,
    recentActivity,
    pipeline,
    recentInquiries,
    reminders,
    counselorPerformance,
    topStates,
  });
});

module.exports = {
  getDashboardStats,
  getSourceSummary,
  getRecentActivity,
  getDashboardOverview,
};
