const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding RBAC users...');

  // 1. CLEAN DATABASE (Careful: deleting users deletes many relations)
  await prisma.refreshToken.deleteMany({});
  await prisma.userPermissionOverride.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.branch.deleteMany({});

  const passwordHash = await bcrypt.hash('Admin@123', 10);

  // 2. DEPARTMENTS
  const deptSales = await prisma.department.create({ data: { name: 'Sales & Admissions' } });
  const deptAdmin = await prisma.department.create({ data: { name: 'Administrative' } });
  const deptFinance = await prisma.department.create({ data: { name: 'Finance' } });

  // 3. BRANCHES
  const branchHQ = await prisma.branch.create({ data: { name: 'Kochi HQ', location: 'Ernakulam' } });

  // 4. CORE USERS
  const superAdmin = await prisma.user.create({
    data: {
      userCode: 'EMP-001',
      fullName: 'Super Admin User',
      email: 'superadmin@campusbridge.com',
      passwordHash,
      role: 'SUPER_ADMIN',
      departmentId: deptAdmin.id,
      branchId: branchHQ.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      userCode: 'EMP-002',
      fullName: 'Head Administrator',
      email: 'admin@campusbridge.com',
      passwordHash,
      role: 'ADMIN',
      departmentId: deptAdmin.id,
      branchId: branchHQ.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      userCode: 'EMP-003',
      fullName: 'Sales Manager One',
      email: 'manager@campusbridge.com',
      passwordHash,
      role: 'MANAGER',
      departmentId: deptSales.id,
      branchId: branchHQ.id,
      reportingManagerId: admin.id
    },
  });

  const accountant = await prisma.user.create({
    data: {
      userCode: 'EMP-004',
      fullName: 'Chief Accountant',
      email: 'accounts@campusbridge.com',
      passwordHash,
      role: 'ACCOUNTANT',
      departmentId: deptFinance.id,
      branchId: branchHQ.id,
    },
  });

  // 5. SALES USERS (10)
  for (let i = 1; i <= 10; i++) {
    const num = i.toString().padStart(2, '0');
    await prisma.user.create({
      data: {
        userCode: `SALES-${num}`,
        fullName: `Sales User ${num}`,
        email: `sales${num}@campusbridge.com`,
        passwordHash,
        role: 'SALES',
        departmentId: deptSales.id,
        branchId: branchHQ.id,
        reportingManagerId: manager.id
      },
    });
  }

  console.log('✅ 14+ Users seeded successfully');
  console.log('🌱 Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
