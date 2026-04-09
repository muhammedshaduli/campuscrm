const prisma = require('../../config/db');
const { sendResponse, ApiError } = require('../../utils/response');
const { asyncHandler } = require('../../middlewares/error');

/**
 * @desc    Create a new invoice for a student/lead
 * @route   POST /api/finance/invoices
 * @access  Private (Admin)
 */
const createInvoice = asyncHandler(async (req, res, next) => {
  const { leadId, studentName, amount, dueDate, notes, items } = req.body;

  const count = await prisma.invoice.count();
  const invoiceNumber = `INV-${2026}${String(count + 1).padStart(4, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      leadId,
      studentName,
      amount: parseFloat(amount),
      dueDate: new Date(dueDate),
      notes,
      createdBy: req.user.id,
      items: {
        create: items.map(item => ({
          description: item.description,
          amount: parseFloat(item.amount)
        }))
      }
    },
    include: { items: true }
  });

  // Log activity
  await prisma.activity.create({
    data: {
      type: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: invoice.id,
      message: `Invoice ${invoiceNumber} created for ${studentName} by ${req.user.fullName}`,
      userId: req.user.id
    }
  });

  sendResponse(res, 201, 'Invoice created successfully', invoice);
});

/**
 * @desc    Get all invoices with filtering and pagination
 * @route   GET /api/finance/invoices
 * @access  Private
 */
const getInvoices = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, studentName } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (studentName) where.studentName = { contains: studentName, mode: 'insensitive' };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { payments: true }
    }),
    prisma.invoice.count({ where })
  ]);

  sendResponse(res, 200, 'Invoices fetched successfully', {
    invoices,
    pagination: { total, page: parseInt(page), limit: parseInt(limit) }
  });
});

/**
 * @desc    Record a payment for an invoice
 * @route   POST /api/finance/payments
 * @access  Private (Admin)
 */
const recordPayment = asyncHandler(async (req, res, next) => {
  const { invoiceId, amount, paymentMethod, referenceNumber, notes, paymentDate } = req.body;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true }
  });

  if (!invoice) return next(new ApiError(404, 'Invoice not found'));

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount: parseFloat(amount),
      paymentMethod,
      referenceNumber,
      notes,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      receivedBy: req.user.id
    }
  });

  // Check if fully paid
  const totalPaid = invoice.payments.reduce((acc, p) => acc + parseFloat(p.amount), 0) + parseFloat(amount);
  if (totalPaid >= parseFloat(invoice.amount)) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'Paid' }
    });
  }

  // Log activity
  await prisma.activity.create({
    data: {
      type: 'PAYMENT_RECEIVED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      message: `Payment of ₹${amount} received for invoice ${invoice.invoiceNumber}`,
      userId: req.user.id
    }
  });

  sendResponse(res, 201, 'Payment recorded successfully', payment);
});

module.exports = {
  createInvoice,
  getInvoices,
  recordPayment,
};
