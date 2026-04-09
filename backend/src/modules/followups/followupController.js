const prisma = require('../../config/db');
const { sendResponse, ApiError } = require('../../utils/response');
const { asyncHandler } = require('../../middlewares/error');

/**
 * @desc    Record a new follow-up for a lead
 * @route   POST /api/followups
 * @access  Private (Admin, Counsellor)
 */
const addFollowup = asyncHandler(async (req, res, next) => {
  const {
    leadId, followupDate, nextCallDate, callStatus,
    leadStatus, notes, notAttended
  } = req.body;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return next(new ApiError(404, 'Lead not found'));

  // Create followup record
  const followup = await prisma.leadFollowup.create({
    data: {
      leadId,
      counsellorId: req.user.id,
      followupDate: followupDate ? new Date(followupDate) : new Date(),
      nextCallDate: nextCallDate ? new Date(nextCallDate) : null,
      callStatus,
      leadStatus,
      notes,
      notAttended: notAttended || false,
    }
  });

  // Sync lead status and dates
  const updateData = {
    status: leadStatus,
    callStatus,
    lastCallDate: followup.followupDate,
    nextCallDate: followup.nextCallDate,
    notAttended: followup.notAttended,
  };

  if (callStatus === 'CALLED') {
    updateData.callAttempts = { increment: 1 };
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: updateData
  });

  // Handle activity logging
  await prisma.activity.create({
    data: {
      type: 'FOLLOWUP_ADDED',
      entityType: 'LEAD',
      entityId: leadId,
      message: `Follow-up added for ${lead.studentName}: ${callStatus} -> ${leadStatus}`,
      userId: req.user.id,
      metadata: { followupId: followup.id }
    }
  });

  // Create automatic reminder if nextCallDate is set
  if (nextCallDate) {
    await prisma.reminder.create({
      data: {
        leadId,
        assignedTo: req.user.id,
        title: `Follow-up: ${lead.studentName}`,
        description: notes || `Follow-up required based on last call status: ${callStatus}`,
        dueDate: new Date(nextCallDate),
        priority: 'MEDIUM'
      }
    });
  }

  sendResponse(res, 201, 'Follow-up recorded successfully', followup);
});

/**
 * @desc    Get follow-up history for a lead
 * @route   GET /api/followups/lead/:leadId
 * @access  Private
 */
const getLeadFollowups = asyncHandler(async (req, res) => {
  const followups = await prisma.leadFollowup.findMany({
    where: { leadId: req.params.leadId },
    orderBy: { createdAt: 'desc' },
    include: { counsellor: { select: { fullName: true } } }
  });
  sendResponse(res, 200, 'Follow-up history fetched', followups);
});

module.exports = {
  addFollowup,
  getLeadFollowups,
};
