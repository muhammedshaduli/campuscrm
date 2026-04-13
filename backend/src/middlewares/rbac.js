/**
 * RBAC Middleware - Module-wise Permission Check
 */
const prisma = require('../config/db');

const checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Set by auth middleware
      const normalizedModule = String(module || '').toUpperCase();
      const normalizedAction = String(action || '').toUpperCase();

      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // 1. SUPER_ADMIN has full access
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }

      // 2. Define default permissions per role
      const roleDefaults = {
        ADMIN: {
          DASHBOARD: ['VIEW'],
          LEADS: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
          STUDENTS: ['VIEW', 'CREATE', 'EDIT'],
          FINANCE: ['VIEW', 'CREATE', 'EDIT'],
          REPORTS: ['VIEW', 'EXPORT'],
          USERS: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
          MASTERS: ['VIEW', 'CREATE', 'EDIT']
        },
        MANAGER: {
          DASHBOARD: ['VIEW'],
          LEADS: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN'],
          REPORTS: ['VIEW', 'EXPORT'],
          USERS: ['VIEW'] // Can see staff
        },
        ACCOUNTANT: {
          FINANCE: ['VIEW', 'CREATE', 'EDIT', 'EXPORT']
        },
        SALES: {
          DASHBOARD: ['VIEW_OWN'],
          LEADS: ['VIEW_OWN', 'CREATE', 'EDIT_OWN', 'FOLLOWUP']
        }
      };

      const userRolePermissions = roleDefaults[user.role] || {};
      const modulePermissions = userRolePermissions[normalizedModule] || [];

      // 3. Check for User-Specific Overrides in Database
      const override = await prisma.userPermissionOverride.findFirst({
        where: {
          userId: user.id,
          module: normalizedModule,
          action: normalizedAction
        }
      });

      if (override) {
        if (override.allowed) return next();
        else return res.status(403).json({ success: false, message: `Access denied to ${normalizedAction} ${normalizedModule}` });
      }

      // 4. Fallback to Role Defaults
      if (modulePermissions.includes(normalizedAction) || modulePermissions.includes('ALL')) {
        return next();
      }

      return res.status(403).json({ success: false, message: `Access denied to ${normalizedAction} ${normalizedModule}` });
    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error during permission check' });
    }
  };
};

module.exports = { checkPermission };
