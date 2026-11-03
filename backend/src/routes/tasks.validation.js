'use strict';
// Request validation rules for the task routes.
const { body, query } = require('express-validator');

const createTaskValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('due_date must be a valid ISO 8601 date'),
  body('project_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('project_id must be a positive integer'),
  body('assignee_ids').optional().isArray().withMessage('assignee_ids must be an array'),
  body('assignee_ids.*').optional().isInt({ min: 1 }).withMessage('Each assignee_id must be a positive integer'),
];

const updateTaskValidation = [
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('due_date').optional({ nullable: true }).isISO8601(),
];

const taskQueryValidation = [
  query('project_id').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString().isLength({ max: 200 }),
  query('priority').optional().isIn(['low', 'medium', 'high']),
  query('status').optional().isIn(['unassigned', 'todo', 'in_progress', 'completed', 'all']),
  query('assignee_id').optional().isInt({ min: 1 }),
  query('created_by').optional().isInt({ min: 1 }),
  query('due_after').optional().isISO8601(),
  query('due_before').optional().isISO8601(),
];

module.exports = { createTaskValidation, updateTaskValidation, taskQueryValidation };
