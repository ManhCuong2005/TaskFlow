'use strict';
const express = require('express');
const { param, body } = require('express-validator');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const projectsController = require('../controllers/projects.controller');
const leaderController = require('../controllers/leader.controller');

const router = express.Router();

router.use(authenticate);

// User's own invitations
router.get('/invitations/me', projectsController.getMyInvitations);
router.post(
  '/invitations/:id/respond',
  [param('id').isInt({ min: 1 }), body('accept').isBoolean()],
  validate,
  projectsController.respondToInvitation
);

router.get('/', projectsController.getProjects);
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Project name must be 2 to 100 characters'),
    body('key').trim().isLength({ min: 2, max: 10 }).withMessage('Project key must be 2 to 10 characters'),
  ],
  validate,
  projectsController.createProject
);

router.get('/:id/leader', param('id').isInt({ min: 1 }), validate, leaderController.getOverview);
router.patch('/:id/members/:userId/permissions', [
  param('id').isInt({ min: 1 }),
  param('userId').isInt({ min: 1 }),
  body('can_update_status').custom(value => typeof value === 'boolean').withMessage('can_update_status must be boolean'),
  body('can_comment').custom(value => typeof value === 'boolean').withMessage('can_comment must be boolean'),
  body('expected_version').custom(value => Number.isInteger(value) && value >= 0).withMessage('expected_version must be a non-negative integer'),
], validate, leaderController.updatePermissions);
router.get('/:id', param('id').isInt({ min: 1 }), validate, projectsController.getProjectById);
router.post(
  '/:id/members',
  [
    param('id').isInt({ min: 1 }),
    body('user_id').isInt({ min: 1 }).withMessage('user_id must be a valid integer'),
  ],
  validate,
  projectsController.addProjectMember
);
router.delete(
  '/:id/members/:userId',
  [param('id').isInt({ min: 1 }), param('userId').isInt({ min: 1 })],
  validate,
  projectsController.removeProjectMember
);

// Project invitations
router.post(
  '/:id/invitations',
  [
    param('id').isInt({ min: 1 }),
    body('user_id').isInt({ min: 1 }).withMessage('user_id must be a valid user ID'),
  ],
  validate,
  projectsController.inviteProjectMember
);
router.get(
  '/:id/invitations',
  param('id').isInt({ min: 1 }),
  validate,
  projectsController.getProjectPendingInvitations
);
router.delete(
  '/:id/invitations/:inviteId',
  [param('id').isInt({ min: 1 }), param('inviteId').isInt({ min: 1 })],
  validate,
  projectsController.cancelInvitation
);

router.delete(
  '/:id',
  param('id').isInt({ min: 1 }),
  validate,
  projectsController.deleteProject
);

module.exports = router;
