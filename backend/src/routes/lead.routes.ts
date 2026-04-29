// lead.routes.ts
import { Router } from 'express';
import {
  getLeads, getLead, createLead, updateLead, deleteLead,
  recommendProperties, logCall, getAgentDashboardStats,
  togglePriority, bulkAssign, importLeads
} from '../controllers/lead.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// ✅ FIX C1: Static-path routes MUST come before /:id to avoid being swallowed
router.get('/dashboard/stats', getAgentDashboardStats);
router.post('/bulk-assign', bulkAssign);
router.post('/import', importLeads);

// Generic CRUD routes (dynamic :id must come AFTER specific paths above)
router.get('/', getLeads);
router.get('/:id', getLead);
router.post('/', createLead);
router.patch('/:id', updateLead);
router.delete('/:id', deleteLead);

// Sub-resource routes on /:id
router.patch('/:id/priority', togglePriority);
router.post('/:id/recommendations', recommendProperties);
router.post('/:id/call-logs', logCall);

export default router;