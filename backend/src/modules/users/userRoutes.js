const express = require('express');
const router = express.Router();
const userController = require('./userController');
const { protect } = require('../../middlewares/auth');
const { checkPermission } = require('../../middlewares/rbac');

router.get('/', protect, checkPermission('USERS', 'VIEW'), userController.getAllUsers);
router.post('/', protect, checkPermission('USERS', 'CREATE'), userController.createUser);
router.put('/:id', protect, checkPermission('USERS', 'EDIT'), userController.updateUser);
router.delete('/:id', protect, checkPermission('USERS', 'DELETE'), userController.deleteUser);
router.patch('/:id/reset-password', protect, checkPermission('USERS', 'EDIT'), userController.resetPassword);
router.patch('/:id/toggle-activation', protect, checkPermission('USERS', 'EDIT'), userController.toggleActivation);

module.exports = router;
