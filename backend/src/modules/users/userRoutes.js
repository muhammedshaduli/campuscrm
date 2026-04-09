const express = require('express');
const router = express.Router();
const userController = require('./userController');
const { authenticate } = require('../../middlewares/auth');
const { checkPermission } = require('../../middlewares/rbac');

router.get('/', authenticate, checkPermission('USERS', 'VIEW'), userController.getAllUsers);
router.post('/', authenticate, checkPermission('USERS', 'CREATE'), userController.createUser);
router.put('/:id', authenticate, checkPermission('USERS', 'EDIT'), userController.updateUser);
router.delete('/:id', authenticate, checkPermission('USERS', 'DELETE'), userController.deleteUser);
router.patch('/:id/reset-password', authenticate, checkPermission('USERS', 'EDIT'), userController.resetPassword);
router.patch('/:id/toggle-activation', authenticate, checkPermission('USERS', 'EDIT'), userController.toggleActivation);

module.exports = router;
