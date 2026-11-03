'use strict';
const express = require('express');
const { param, query } = require('express-validator');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createTaskValidation, updateTaskValidation, taskQueryValidation } = require('./tasks.validation');
const tasksController = require('../controllers/tasks.controller');
const assignmentsRouter = require('./assignments.routes');
const historyRouter = require('./history.routes');
const commentsRouter = require('./comments.routes');
const documentsController = require('../controllers/documents.controller');
const uploadFiles = require('../middlewares/uploadFiles');

const router = express.Router();
const taskIdValidation = [param('id').isInt({ min: 1 }).withMessage('Task id must be a positive integer'), validate];

router.use(authenticate);

router.post('/', createTaskValidation, validate, tasksController.createTask);
router.get('/', taskQueryValidation, validate, tasksController.getTasks);
router.get('/stats', query('project_id').optional().isInt({ min: 1 }), validate, tasksController.getTaskStats);
router.get('/:id', param('id').isInt({ min: 1 }).withMessage('Task id must be a positive integer'), validate, tasksController.getTaskById);
router.patch('/:id', param('id').isInt({ min: 1 }), updateTaskValidation, validate, tasksController.updateTask);
router.patch('/:id/status', taskIdValidation, tasksController.updateTaskStatus);
router.delete('/:id', param('id').isInt({ min: 1 }), validate, tasksController.deleteTask);
router.get('/:id/documents', taskIdValidation, documentsController.listTaskDocuments);
router.post('/:id/documents', taskIdValidation, uploadFiles, documentsController.uploadTaskDocuments);
router.get('/:id/documents/:documentId/url', [
  param('id').isInt({ min: 1 }),
  param('documentId').isInt({ min: 1 }),
  query('disposition').optional().isIn(['inline', 'attachment']),
], validate, documentsController.getSignedUrl);
router.get('/:id/reports', taskIdValidation, documentsController.listReports);
router.get('/:id/reports/:reportId/documents/:documentId/url', [
  param('id').isInt({ min: 1 }),
  param('reportId').isInt({ min: 1 }),
  param('documentId').isInt({ min: 1 }),
  query('disposition').optional().isIn(['inline', 'attachment']),
], validate, documentsController.getSignedUrl);

// Nested routers
router.use('/:id/assignments', taskIdValidation, assignmentsRouter);
router.use('/:id/history', taskIdValidation, historyRouter);
router.use('/:id/comments', taskIdValidation, commentsRouter);

module.exports = router;
