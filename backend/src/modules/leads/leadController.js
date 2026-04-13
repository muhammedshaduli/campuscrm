const prisma = require('../../config/db');
const { sendResponse, ApiError } = require('../../utils/response');
const { asyncHandler } = require('../../middlewares/error');

/**
 * @desc    Create a new lead
 * @route   POST /api/leads
 * @access  Private (Admin, Counsellor)
 */
const createLead = asyncHandler(async (req, res, next) => {
  const {
    studentName, phone, whatsappNumber, dob, email, area,
    districtId, stateId, preferredCourseId, collegeId,
    source, assignedCounsellorId, status, notes,
    lastCallDate, nextCallDate, callAttempts
  } = req.body;

  // Generate unique lead code
  const count = await prisma.lead.count();
  const leadCode = `CCRM-${4000 + count + 1}`;
  const resolvedCounsellorId = assignedCounsellorId || (req.user.role === 'SALES' ? req.user.id : null);

  const lead = await prisma.lead.create({
    data: {
      leadCode,
      studentName,
      phone,
      whatsappNumber: whatsappNumber || phone,
      dob: dob ? new Date(dob) : null,
      email,
      area,
      districtId: districtId ? parseInt(districtId) : null,
      stateId: stateId ? parseInt(stateId) : null,
      preferredCourseId,
      collegeId,
      source,
      assignedCounsellorId: resolvedCounsellorId,
      status: status || 'NEW_ENQUIRY',
      lastCallDate: lastCallDate ? new Date(lastCallDate) : null,
      nextCallDate: nextCallDate ? new Date(nextCallDate) : null,
      callAttempts: Number.isFinite(Number(callAttempts)) ? Number(callAttempts) : 0,
      notes,
      createdBy: req.user.id,
    },
    include: {
      district: true,
      state: true,
      preferredCourse: true,
      college: true,
      assignedCounsellor: true
    }
  });

  // Log activity
  await prisma.activity.create({
    data: {
      type: 'LEAD_CREATED',
      entityType: 'LEAD',
      entityId: lead.id,
      leadId: lead.id,
      message: `Lead ${lead.studentName} created by ${req.user.fullName}`,
      userId: req.user.id
    }
  });

  if (lead.nextCallDate && resolvedCounsellorId) {
    await prisma.reminder.create({
      data: {
        leadId: lead.id,
        assignedTo: resolvedCounsellorId,
        title: `Initial follow-up: ${lead.studentName}`,
        description: notes || 'Follow up on newly created lead enquiry.',
        dueDate: lead.nextCallDate,
        priority: 'MEDIUM',
      },
    });
  }

  sendResponse(res, 201, 'Lead created successfully', lead);
});

/**
 * @desc    Get all leads with filtering, search, and pagination
 * @route   GET /api/leads
 * @access  Private
 */
const getLeads = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 10, search, status, source,
    stateId, districtId, counsellorId, notAttended
  } = req.query;

  const skip = (page - 1) * limit;
  
  const where = {};
  
  // Role based filtering: Sales users see only their assigned leads
  if (req.user.role === 'SALES') {
    where.assignedCounsellorId = req.user.id;
  } else if (counsellorId) {
    where.assignedCounsellorId = counsellorId;
  }

  if (status) where.status = status;
  if (source) where.source = source;
  if (stateId) where.stateId = parseInt(stateId);
  if (districtId) where.districtId = parseInt(districtId);
  if (notAttended === 'true') where.notAttended = true;

  if (search) {
    where.OR = [
      { studentName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
      { leadCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        district: true,
        state: true,
        preferredCourse: true,
        college: true,
        assignedCounsellor: { select: { id: true, fullName: true, email: true } }
      }
    }),
    prisma.lead.count({ where })
  ]);

  sendResponse(res, 200, 'Leads fetched successfully', {
    leads,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }
  });
});

/**
 * @desc    Update lead details
 * @route   PATCH /api/leads/:id
 * @access  Private
 */
const updateLead = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const data = req.body;

  // Basic ownership check for counsellors
  const existingLead = await prisma.lead.findUnique({ where: { id } });
  if (!existingLead) return next(new ApiError(404, 'Lead not found'));

  if (req.user.role === 'SALES' && existingLead.assignedCounsellorId !== req.user.id) {
    return next(new ApiError(403, 'Unauthorized to update this lead'));
  }

  const updatedLead = await prisma.lead.update({
    where: { id },
    data: {
      ...data,
      dob: data.dob ? new Date(data.dob) : undefined,
      lastCallDate: data.lastCallDate ? new Date(data.lastCallDate) : undefined,
      nextCallDate: data.nextCallDate ? new Date(data.nextCallDate) : undefined,
    },
    include: {
      district: true,
      state: true,
      preferredCourse: true,
      college: true,
      assignedCounsellor: true
    }
  });

  // Log activity if status changed
  if (data.status && data.status !== existingLead.status) {
    await prisma.activity.create({
      data: {
        type: 'STATUS_CHANGED',
        entityType: 'LEAD',
        entityId: id,
        leadId: id,
        message: `Lead ${updatedLead.studentName} status changed to ${data.status}`,
        userId: req.user.id,
        metadata: { old: existingLead.status, new: data.status }
      }
    });
  }

  sendResponse(res, 200, 'Lead updated successfully', updatedLead);
});

/**
 * @desc    Get single lead details
 * @route   GET /api/leads/:id
 * @access  Private
 */
const getLeadById = asyncHandler(async (req, res, next) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      district: true,
      state: true,
      preferredCourse: true,
      college: true,
      assignedCounsellor: { select: { id: true, fullName: true, email: true } },
      followups: { orderBy: { createdAt: 'desc' } },
      reminders: true,
      invoices: true
    }
  });

  if (!lead) return next(new ApiError(404, 'Lead not found'));
  
  if (req.user.role === 'SALES' && lead.assignedCounsellorId !== req.user.id) {
    return next(new ApiError(403, 'Access denied to this lead profile'));
  }

  sendResponse(res, 200, 'Lead details fetched', lead);
});

module.exports = {
  createLead,
  getLeads,
  updateLead,
  getLeadById,
};
