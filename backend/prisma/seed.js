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

  const college = await prisma.college.findFirst({
    where: { name: 'Calviz Partner College' },
  });

  if (!college) {
    await prisma.college.create({
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

async function main() {
  console.log('Seeding Calviz CampusCRM defaults...');

  const supportData = await upsertSupportData();
  const seededUsers = [];

  for (const userConfig of defaultUsers) {
    const user = await upsertUser(userConfig, supportData);
    seededUsers.push(user);
  }

  console.log('Default users are ready:');
  defaultUsers.forEach((user) => {
    console.log(`- ${user.role}: ${user.email} / ${user.password}`);
  });

  console.log('Calviz CampusCRM seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
