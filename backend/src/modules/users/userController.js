/**
 * User Controller - User Management CRUD & Role/Permission Assignment
 */
const prisma = require('../../config/db');
const bcrypt = require('bcrypt');

const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        userCode: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isSuspended: true,
        department: { select: { name: true } },
        lastLoginAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

const createUser = async (req, res) => {
  try {
    const { fullName, email, password, role, userCode, phone, departmentId } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const existing = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role,
        userCode,
        phone,
        departmentId,
        createdBy: req.user.id
      }
    });

    res.json({ success: true, data: { id: user.id, fullName: user.fullName } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, phone, departmentId, isActive, isSuspended, userCode, designation } = req.body;

    if (email) {
      const existing = await prisma.user.findFirst({
        where: {
          id: { not: id },
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
      });

      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: { fullName, email, role, phone, departmentId, isActive, isSuspended, userCode, designation }
    });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    // Hard delete for now, or use soft-delete by updating isActive
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

const toggleActivation = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive }
    });
    res.json({ success: true, message: `User ${user.isActive ? 'deactivated' : 'activated'} successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Action failed' });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  toggleActivation
};
