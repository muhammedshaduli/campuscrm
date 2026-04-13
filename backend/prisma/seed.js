const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD_SALT_ROUNDS = 10;

const departments = [
  { name: 'Administrative' },
  { name: 'Sales & Admissions' },
];

const branch = {
  name: 'Calviz HQ',
  location: 'Kochi, Kerala',
};

const defaultUsers = [
  {
    fullName: 'Admin User',
    email: 'admin@calviz.in',
    role: 'ADMIN',
    password: 'Admin@123',
    userCode: 'CAL-ADM-001',
    phone: '+91-9000000001',
    designation: 'Administrator',
    departmentName: 'Administrative',
  },
  {
    fullName: 'Manager User',
    email: 'Manager@calviz.in',
    role: 'MANAGER',
    password: 'Manager@123',
    userCode: 'CAL-MGR-001',
    phone: '+91-9000000002',
    designation: 'Admissions Manager',
    departmentName: 'Sales & Admissions',
    reportingManagerEmail: 'admin@calviz.in',
  },
  {
    fullName: 'Sales User 01',
    email: 'User1@calviz.in',
    role: 'SALES',
    password: 'Sales@123',
    userCode: 'CAL-SAL-001',
    phone: '+91-9000000003',
    designation: 'Sales Counselor',
    departmentName: 'Sales & Admissions',
    reportingManagerEmail: 'Manager@calviz.in',
  },
];

const daysFromNow = (offset, hour = 10) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};

const daysAgo = (offset, hour = 11) => daysFromNow(offset * -1, hour);

async function findUserByEmail(email) {
  return prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
  });
}

async function upsertSupportData() {
  const departmentMap = new Map();

  for (const department of departments) {
    const record = await prisma.department.upsert({
      where: { name: department.name },
      update: {},
      create: department,
    });

    departmentMap.set(record.name, record);
  }

  const branchRecord = await prisma.branch.upsert({
    where: { name: branch.name },
    update: { location: branch.location },
    create: branch,
  });

  const state = await prisma.state.upsert({
    where: { name: 'Kerala' },
    update: {},
    create: { name: 'Kerala' },
  });

  const district = await prisma.district.upsert({
    where: {
      name_stateId: {
        name: 'Ernakulam',
        stateId: state.id,
      },
    },
    update: {},
    create: {
      name: 'Ernakulam',
      stateId: state.id,
    },
  });

  const course = await prisma.course.upsert({
    where: { name: 'MBA International Business' },
    update: {
      duration: '2 Years',
      isActive: true,
    },
    create: {
      name: 'MBA International Business',
      duration: '2 Years',
      isActive: true,
    },
  });

  let college = await prisma.college.findFirst({
    where: { name: 'Calviz Partner College' },
  });

  if (!college) {
    college = await prisma.college.create({
      data: {
        name: 'Calviz Partner College',
        stateId: state.id,
        districtId: district.id,
        address: 'Kochi, Kerala',
        contactEmail: 'admissions@calviz.in',
        contactPhone: '+91-9000000010',
        isActive: true,
      },
    });
  }

  return {
    branch: branchRecord,
    departments: departmentMap,
    state,
    district,
    course,
    college,
  };
}

async function upsertUser(userConfig, supportData) {
  const department = supportData.departments.get(userConfig.departmentName);
  const manager =
    userConfig.reportingManagerEmail &&
    (await findUserByEmail(userConfig.reportingManagerEmail));

  const passwordHash = await bcrypt.hash(userConfig.password, DEFAULT_PASSWORD_SALT_ROUNDS);
  const existingUser = await findUserByEmail(userConfig.email);

  const userPayload = {
    fullName: userConfig.fullName,
    email: userConfig.email,
    role: userConfig.role,
    passwordHash,
    userCode: userConfig.userCode,
    phone: userConfig.phone,
    designation: userConfig.designation,
    departmentId: department?.id || null,
    branchId: supportData.branch.id,
    reportingManagerId: manager?.id || null,
    isActive: true,
    isSuspended: false,
  };

  if (existingUser) {
    return prisma.user.update({
      where: { id: existingUser.id },
      data: userPayload,
    });
  }

  return prisma.user.create({
    data: userPayload,
  });
}

async function seedSampleCrmData(supportData, userMap) {
  const existingLeadCount = await prisma.lead.count();
  if (existingLeadCount > 0) {
    return { createdLeadCount: 0, createdReminderCount: 0, createdFollowupCount: 0 };
  }

  const salesUser = userMap.get('user1@calviz.in');
  const managerUser = userMap.get('manager@calviz.in');
  const adminUser = userMap.get('admin@calviz.in');

  const leadBlueprints = [
    {
      leadCode: 'CCRM-SAMPLE-001',
      studentName: 'Aadya Nair',
      phone: '+91-9884700101',
      whatsappNumber: '+91-9884700101',
      email: 'aadya.nair@example.com',
      area: 'Edappally',
      source: 'WEBSITE',
      status: 'NEW_ENQUIRY',
      callStatus: 'PENDING',
      priority: 'HIGH',
      callAttempts: 0,
      notes: 'Website enquiry for the 2026 intake.',
      createdAt: daysAgo(0, 9),
      nextCallDate: daysFromNow(1, 10),
      assignedCounsellorId: salesUser.id,
    },
    {
      leadCode: 'CCRM-SAMPLE-002',
      studentName: 'Riya Mathew',
      phone: '+91-9884700102',
      whatsappNumber: '+91-9884700102',
      email: 'riya.mathew@example.com',
      area: 'Kaloor',
      source: 'WHATSAPP',
      status: 'COUNSELING',
      callStatus: 'FOLLOWUP_NEEDED',
      priority: 'MEDIUM',
      callAttempts: 2,
      notes: 'Requested scholarship and hostel details.',
      createdAt: daysAgo(2, 11),
      lastCallDate: daysAgo(1, 16),
      nextCallDate: daysFromNow(2, 11),
      assignedCounsellorId: salesUser.id,
    },
    {
      leadCode: 'CCRM-SAMPLE-003',
      studentName: 'Adil Rahman',
      phone: '+91-9884700103',
      whatsappNumber: '+91-9884700103',
      email: 'adil.rahman@example.com',
      area: 'Thrippunithura',
      source: 'REFERRAL',
      status: 'INTERESTED',
      callStatus: 'CALLED',
      priority: 'HIGH',
      callAttempts: 3,
      notes: 'Interested after alumni referral. Wants fee breakup.',
      createdAt: daysAgo(4, 12),
      lastCallDate: daysAgo(1, 14),
      nextCallDate: daysFromNow(3, 15),
      assignedCounsellorId: salesUser.id,
    },
    {
      leadCode: 'CCRM-SAMPLE-004',
      studentName: 'Nithya Krishnan',
      phone: '+91-9884700104',
      whatsappNumber: '+91-9884700104',
      email: 'nithya.krishnan@example.com',
      area: 'Kakkanad',
      source: 'WALK_IN',
      status: 'ADMISSION_CONFIRMED',
      callStatus: 'CLOSED',
      priority: 'MEDIUM',
      callAttempts: 4,
      notes: 'Confirmed admission after campus visit.',
      createdAt: daysAgo(6, 10),
      lastCallDate: daysAgo(2, 12),
      assignedCounsellorId: salesUser.id,
    },
    {
      leadCode: 'CCRM-SAMPLE-005',
      studentName: 'Farhan Ali',
      phone: '+91-9884700105',
      whatsappNumber: '+91-9884700105',
      email: 'farhan.ali@example.com',
      area: 'Aluva',
      source: 'INSTAGRAM',
      status: 'NOT_ATTENDED',
      callStatus: 'NOT_ATTENDED',
      priority: 'LOW',
      callAttempts: 1,
      notAttended: true,
      notes: 'Did not attend the scheduled counseling call.',
      createdAt: daysAgo(1, 13),
      lastCallDate: daysAgo(0, 10),
      nextCallDate: daysFromNow(1, 17),
      assignedCounsellorId: salesUser.id,
    },
    {
      leadCode: 'CCRM-SAMPLE-006',
      studentName: 'Sandra Joseph',
      phone: '+91-9884700106',
      whatsappNumber: '+91-9884700106',
      email: 'sandra.joseph@example.com',
      area: 'Palarivattom',
      source: 'GOOGLE_ADS',
      status: 'NOT_INTERESTED',
      callStatus: 'CLOSED',
      priority: 'LOW',
      callAttempts: 2,
      notes: 'Moved forward with another institute.',
      createdAt: daysAgo(8, 15),
      lastCallDate: daysAgo(5, 11),
      assignedCounsellorId: salesUser.id,
    },
  ];

  const createdLeads = [];

  for (const blueprint of leadBlueprints) {
    const lead = await prisma.lead.create({
      data: {
        leadCode: blueprint.leadCode,
        studentName: blueprint.studentName,
        phone: blueprint.phone,
        whatsappNumber: blueprint.whatsappNumber,
        email: blueprint.email,
        area: blueprint.area,
        districtId: supportData.district.id,
        stateId: supportData.state.id,
        preferredCourseId: supportData.course.id,
        collegeId: supportData.college.id,
        source: blueprint.source,
        assignedCounsellorId: blueprint.assignedCounsellorId,
        status: blueprint.status,
        callStatus: blueprint.callStatus,
        lastCallDate: blueprint.lastCallDate || null,
        nextCallDate: blueprint.nextCallDate || null,
        notAttended: blueprint.notAttended || false,
        callAttempts: blueprint.callAttempts,
        priority: blueprint.priority,
        notes: blueprint.notes,
        createdBy: managerUser.id,
        createdAt: blueprint.createdAt,
      },
    });

    createdLeads.push(lead);

    await prisma.activity.create({
      data: {
        type: 'LEAD_CREATED',
        entityType: 'LEAD',
        entityId: lead.id,
        leadId: lead.id,
        message: `${lead.studentName} enquiry captured from ${blueprint.source.replace(/_/g, ' ')}`,
        userId: managerUser.id,
        createdAt: blueprint.createdAt,
      },
    });
  }

  const leadMap = new Map(createdLeads.map((lead) => [lead.leadCode, lead]));

  const followups = [
    {
      leadCode: 'CCRM-SAMPLE-002',
      followupDate: daysAgo(1, 16),
      nextCallDate: daysFromNow(2, 11),
      callStatus: 'FOLLOWUP_NEEDED',
      leadStatus: 'COUNSELING',
      notes: 'Shared fee structure and promised brochure by WhatsApp.',
      notAttended: false,
    },
    {
      leadCode: 'CCRM-SAMPLE-003',
      followupDate: daysAgo(1, 14),
      nextCallDate: daysFromNow(3, 15),
      callStatus: 'CALLED',
      leadStatus: 'INTERESTED',
      notes: 'Student requested another counseling call with parent.',
      notAttended: false,
    },
    {
      leadCode: 'CCRM-SAMPLE-005',
      followupDate: daysAgo(0, 10),
      nextCallDate: daysFromNow(1, 17),
      callStatus: 'NOT_ATTENDED',
      leadStatus: 'NOT_ATTENDED',
      notes: 'Call missed. Rescheduled for tomorrow evening.',
      notAttended: true,
    },
  ];

  for (const item of followups) {
    const lead = leadMap.get(item.leadCode);
    if (!lead) {
      continue;
    }

    await prisma.leadFollowup.create({
      data: {
        leadId: lead.id,
        counsellorId: salesUser.id,
        followupDate: item.followupDate,
        nextCallDate: item.nextCallDate,
        callStatus: item.callStatus,
        leadStatus: item.leadStatus,
        notes: item.notes,
        notAttended: item.notAttended,
        createdAt: item.followupDate,
      },
    });

    await prisma.activity.create({
      data: {
        type: 'FOLLOWUP_ADDED',
        entityType: 'LEAD',
        entityId: lead.id,
        leadId: lead.id,
        message: item.notes,
        userId: salesUser.id,
        createdAt: item.followupDate,
      },
    });
  }

  const reminders = createdLeads
    .filter((lead) => lead.nextCallDate)
    .map((lead) => ({
      leadId: lead.id,
      assignedTo: salesUser.id,
      title: `Follow-up with ${lead.studentName}`,
      description: lead.notes || 'Scheduled counseling follow-up.',
      dueDate: lead.nextCallDate,
      priority: lead.priority,
      createdAt: daysAgo(0, 8),
    }));

  for (const reminder of reminders) {
    await prisma.reminder.create({ data: reminder });
  }

  await prisma.activity.create({
    data: {
      type: 'DASHBOARD_SEEDED',
      entityType: 'SYSTEM',
      entityId: 'dashboard-seed',
      message: 'Sample CRM activity generated for dashboard validation.',
      userId: adminUser.id,
      createdAt: daysAgo(0, 7),
    },
  });

  return {
    createdLeadCount: createdLeads.length,
    createdReminderCount: reminders.length,
    createdFollowupCount: followups.length,
  };
}

async function main() {
  console.log('Seeding Calviz CampusCRM defaults...');

  const supportData = await upsertSupportData();
  const seededUsers = [];

  for (const userConfig of defaultUsers) {
    const user = await upsertUser(userConfig, supportData);
    seededUsers.push(user);
  }

  const userMap = new Map(
    seededUsers.map((user) => [user.email.toLowerCase(), user])
  );

  const sampleData = await seedSampleCrmData(supportData, userMap);

  console.log(
    `Calviz CampusCRM seed completed successfully for ${seededUsers.length} default users.`
  );

  if (sampleData.createdLeadCount > 0) {
    console.log(
      `Added ${sampleData.createdLeadCount} sample leads, ${sampleData.createdFollowupCount} follow-ups, and ${sampleData.createdReminderCount} reminders for local/live dashboard validation.`
    );
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
