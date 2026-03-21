import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

// ==================== PIPELINE STAGES ====================
// Any payment can be set to any stage at any time (non-linear)
// Agents can only change stages on their own leads/payments
// Admin & Superadmin can change stages on all payments

export const PIPELINE_STAGES = [
  { key: 'token',        label: 'Token',        color: '#7F77DD' },
  { key: 'check',        label: 'Check Received', color: '#378ADD' },
  { key: 'agreement',   label: 'Agreement',     color: '#EF9F27' },
  { key: 'registration', label: 'Registration',  color: '#1D9E75' },
  { key: 'possession',  label: 'Possession',    color: '#D85A30' },
  { key: 'closed',      label: 'Closed',        color: '#639922' },
] as const;

export type PipelineStageKey = typeof PIPELINE_STAGES[number]['key'];

// ==================== SCHEMAS ====================

const createPaymentSchema = z.object({
  leadId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  amount: z.number().positive(),
  paymentType: z.enum(['booking_amount', 'installment', 'down_payment', 'registration', 'other']),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer', 'upi', 'credit_card', 'other']).optional().nullable(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).default('pending'),
  pipelineStage: z.enum(['token', 'check', 'agreement', 'registration', 'possession', 'closed']).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  installmentNumber: z.number().int().optional().nullable(),
  totalInstallments: z.number().int().optional().nullable()
});

const updatePaymentSchema = createPaymentSchema.partial();

const createPaymentScheduleSchema = z.object({
  dealId: z.string().optional().nullable(),
  leadId: z.string(),
  propertyId: z.string().optional().nullable(),
  totalAmount: z.number().positive(),
  bookingAmount: z.number().positive(),
  installments: z.array(z.object({
    amount: z.number().positive(),
    dueDate: z.string(),
    description: z.string().optional()
  }))
});

const recordPaymentSchema = z.object({
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer', 'upi', 'credit_card', 'other']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  receiptGenerate: z.boolean().default(true)
});

const updatePipelineStageSchema = z.object({
  pipelineStage: z.enum(['token', 'check', 'agreement', 'registration', 'possession', 'closed']),
  notes: z.string().optional()
});

// ==================== HELPERS ====================

// ==================== CONTROLLERS ====================

export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { status, leadId, dealId, propertyId, overdueOnly, pipelineStage } = req.query;
    const { role, userId } = req.user!;

    const where: any = {};

    // Role-based scoping
    if (role === 'agent') {
      where.lead = { assignedToId: userId };
    }

    if (status) where.status = status;
    if (leadId) where.leadId = leadId;
    if (dealId) where.dealId = dealId;
    if (propertyId) where.propertyId = propertyId;
    if (pipelineStage) where.pipelineStage = pipelineStage;

    if (overdueOnly === 'true') {
      where.status = 'pending';
      where.dueDate = { lt: new Date() };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true, assignedToId: true } },
        deal: { select: { id: true, dealValue: true, stage: true } },
        property: { select: { id: true, title: true, location: true, price: true } },
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          take: 5,
          include: {
            changedBy: { select: { id: true, fullName: true, role: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(payments);
  } catch (error) {
    console.error('Get Payments Error:', error);
    return res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

export const getPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user!;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        lead: true,
        deal: true,
        property: true,
        stageHistory: {
          orderBy: { changedAt: 'asc' },
          include: {
            changedBy: { select: { id: true, fullName: true, role: true } }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Agent can only view their own lead's payment
    if (role === 'agent' && payment.lead?.assignedToId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(payment);
  } catch (error) {
    console.error('Get Payment Error:', error);
    return res.status(500).json({ error: 'Failed to fetch payment' });
  }
};

export const createPayment = async (req: AuthRequest, res: Response) => {
  try {
    const data = createPaymentSchema.parse(req.body);
    const { role, userId } = req.user!;

    // If agent, verify the lead belongs to them
    if (role === 'agent' && data.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
      if (!lead || lead.assignedToId !== userId) {
        return res.status(403).json({ error: 'You can only create payments for your own leads' });
      }
    }

    const payment = await prisma.payment.create({
      data: {
        leadId: data.leadId || null,
        dealId: data.dealId || null,
        propertyId: data.propertyId || null,
        amount: data.amount,
        paymentType: data.paymentType,
        paymentMethod: data.paymentMethod || null,
        status: data.status,
        pipelineStage: data.pipelineStage || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
        installmentNumber: data.installmentNumber || null,
        totalInstallments: data.totalInstallments || null
      },
      include: {
        lead: true,
        deal: true,
        property: true
      }
    });

    // If a stage was set at creation, record it in history
    if (data.pipelineStage) {
      await prisma.paymentStageHistory.create({
        data: {
          paymentId: payment.id,
          stage: data.pipelineStage,
          changedById: userId,
          notes: 'Initial stage set on creation'
        }
      });
    }

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'payment_recorded',
        entityType: 'payment',
        entityId: payment.id,
        details: {
          amount: payment.amount,
          paymentType: payment.paymentType,
          pipelineStage: data.pipelineStage,
          leadName: payment.lead?.name
        }
      }
    });

    return res.status(201).json(payment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create Payment Error:', error);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
};

export const updatePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updatePaymentSchema.parse(req.body);
    const { role, userId } = req.user!;

    // Fetch existing payment to check access
    const existing = await prisma.payment.findUnique({
      where: { id },
      include: { lead: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Agent can only update their own lead's payment
    if (role === 'agent' && existing.lead?.assignedToId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData: any = {};
    if (data.leadId !== undefined) updateData.leadId = data.leadId;
    if (data.dealId !== undefined) updateData.dealId = data.dealId;
    if (data.propertyId !== undefined) updateData.propertyId = data.propertyId;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.paymentType !== undefined) updateData.paymentType = data.paymentType;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.pipelineStage !== undefined) updateData.pipelineStage = data.pipelineStage;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.referenceNumber !== undefined) updateData.referenceNumber = data.referenceNumber;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.installmentNumber !== undefined) updateData.installmentNumber = data.installmentNumber;
    if (data.totalInstallments !== undefined) updateData.totalInstallments = data.totalInstallments;
    if (data.status === 'completed') updateData.paidAt = new Date();

    const payment = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: { lead: true, deal: true, property: true }
    });

    // If pipeline stage changed, record in history
    if (data.pipelineStage && data.pipelineStage !== existing.pipelineStage) {
      await prisma.paymentStageHistory.create({
        data: {
          paymentId: payment.id,
          stage: data.pipelineStage,
          previousStage: existing.pipelineStage || null,
          changedById: userId,
          notes: data.notes || null
        }
      });

      await prisma.activityLog.create({
        data: {
          userId,
          action: 'pipeline_stage_changed',
          entityType: 'payment',
          entityId: id,
          details: {
            from: existing.pipelineStage,
            to: data.pipelineStage,
            leadName: existing.lead?.name
          }
        }
      });
    }

    return res.json(payment);
  } catch (error) {
    console.error('Update Payment Error:', error);
    return res.status(500).json({ error: 'Failed to update payment' });
  }
};

// ==================== PIPELINE STAGE UPDATE ====================

/**
 * Dedicated endpoint to update ONLY the pipeline stage of a payment.
 * Agents can only update their own leads. Admin/Superadmin can update any.
 */
export const updatePipelineStage = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { pipelineStage, notes } = updatePipelineStageSchema.parse(req.body);
    const { role, userId } = req.user!;

    const existing = await prisma.payment.findUnique({
      where: { id },
      include: { lead: { select: { id: true, name: true, assignedToId: true } } }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Agent access check
    if (role === 'agent' && existing.lead?.assignedToId !== userId) {
      return res.status(403).json({ error: 'You can only update stages for your own leads' });
    }

    const previousStage = existing.pipelineStage;

    // Update the stage
    const payment = await prisma.payment.update({
      where: { id },
      data: { pipelineStage },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        deal: { select: { id: true, dealValue: true } },
        property: { select: { id: true, title: true } },
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          take: 10,
          include: {
            changedBy: { select: { id: true, fullName: true, role: true } }
          }
        }
      }
    });

    // Record in stage history
    await prisma.paymentStageHistory.create({
      data: {
        paymentId: id,
        stage: pipelineStage,
        previousStage: previousStage || null,
        changedById: userId,
        notes: notes || null
      }
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'pipeline_stage_changed',
        entityType: 'payment',
        entityId: id,
        details: {
          from: previousStage || 'none',
          to: pipelineStage,
          leadName: existing.lead?.name,
          notes
        }
      }
    });

    return res.json(payment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update Pipeline Stage Error:', error);
    return res.status(500).json({ error: 'Failed to update pipeline stage' });
  }
};

// ==================== PIPELINE VIEW ====================

/**
 * Returns payments grouped by pipeline stage.
 * Agents see only their leads. Admin/Superadmin see all.
 */
export const getPipelineView = async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!;

    const where: any = {};
    if (role === 'agent') {
      where.lead = { assignedToId: userId };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, assignedToId: true } },
        deal: { select: { id: true, dealValue: true, stage: true } },
        property: { select: { id: true, title: true } },
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1,
          include: {
            changedBy: { select: { id: true, fullName: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Group by pipeline stage
    const grouped: Record<string, any> = {};

    for (const stage of PIPELINE_STAGES) {
      grouped[stage.key] = {
        stage: stage.key,
        label: stage.label,
        color: stage.color,
        payments: [],
        totalAmount: 0,
        count: 0
      };
    }

    // Payments with no stage go into an "unassigned" bucket
    grouped['unassigned'] = {
      stage: 'unassigned',
      label: 'Unassigned',
      color: '#888780',
      payments: [],
      totalAmount: 0,
      count: 0
    };

    for (const payment of payments) {
      const key = payment.pipelineStage || 'unassigned';
      if (grouped[key]) {
        grouped[key].payments.push(payment);
        grouped[key].totalAmount += payment.amount;
        grouped[key].count += 1;
      }
    }

    return res.json({
      stages: Object.values(grouped),
      totalPayments: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0)
    });
  } catch (error) {
    console.error('Get Pipeline View Error:', error);
    return res.status(500).json({ error: 'Failed to fetch pipeline view' });
  }
};

// ==================== STAGE HISTORY ====================

export const getStageHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user!;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { lead: { select: { assignedToId: true } } }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (role === 'agent' && payment.lead?.assignedToId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = await prisma.paymentStageHistory.findMany({
      where: { paymentId: id },
      orderBy: { changedAt: 'asc' },
      include: {
        changedBy: { select: { id: true, fullName: true, role: true } }
      }
    });

    return res.json(history);
  } catch (error) {
    console.error('Get Stage History Error:', error);
    return res.status(500).json({ error: 'Failed to fetch stage history' });
  }
};

// ==================== EXISTING FUNCTIONS (UNCHANGED) ====================

export const deletePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin' && req.user!.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only admins can delete payments' });
    }

    await prisma.payment.delete({ where: { id } });

    return res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete Payment Error:', error);
    return res.status(500).json({ error: 'Failed to delete payment' });
  }
};

export const createPaymentSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const data = createPaymentScheduleSchema.parse(req.body);
    const { role, userId } = req.user!;

    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Agent can only create schedule for their own lead
    if (role === 'agent' && lead.assignedToId !== userId) {
      return res.status(403).json({ error: 'You can only create schedules for your own leads' });
    }

    if (data.dealId) {
      const deal = await prisma.deal.findUnique({ where: { id: data.dealId } });
      if (!deal) return res.status(404).json({ error: 'Deal not found' });
    }

    if (data.propertyId) {
      const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
      if (!property) return res.status(404).json({ error: 'Property not found' });
    }

    const payments = [];

    // Booking amount — auto-tagged as token stage
    const bookingPayment = await prisma.payment.create({
      data: {
        leadId: data.leadId,
        dealId: data.dealId || null,
        propertyId: data.propertyId || null,
        amount: data.bookingAmount,
        paymentType: 'booking_amount',
        status: 'pending',
        pipelineStage: 'token'
      }
    });

    await prisma.paymentStageHistory.create({
      data: {
        paymentId: bookingPayment.id,
        stage: 'token',
        changedById: userId,
        notes: 'Auto-set on schedule creation'
      }
    });

    payments.push(bookingPayment);

    // Installments
    for (let i = 0; i < data.installments.length; i++) {
      const inst = data.installments[i];
      const instPayment = await prisma.payment.create({
        data: {
          leadId: data.leadId,
          dealId: data.dealId || null,
          propertyId: data.propertyId || null,
          amount: inst.amount,
          paymentType: 'installment',
          status: 'pending',
          dueDate: new Date(inst.dueDate),
          notes: inst.description || null,
          installmentNumber: i + 1,
          totalInstallments: data.installments.length,
          pipelineStage: null // installments start unassigned
        }
      });
      payments.push(instPayment);
    }

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'payment_schedule_created',
        entityType: 'lead',
        entityId: data.leadId,
        details: {
          totalAmount: data.totalAmount,
          bookingAmount: data.bookingAmount,
          installmentCount: data.installments.length
        }
      }
    });

    return res.status(201).json({
      message: 'Payment schedule created',
      payments
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create Payment Schedule Error:', error);
    return res.status(500).json({ error: 'Failed to create payment schedule' });
  }
};

export const recordPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = recordPaymentSchema.parse(req.body);
    const { role, userId } = req.user!;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { lead: true, property: true }
    });

    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status === 'completed') return res.status(400).json({ error: 'Payment already completed' });

    // Agent access check
    if (role === 'agent' && payment.lead?.assignedToId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status: 'completed',
        paidAt: new Date(),
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        notes: data.notes
      },
      include: { lead: true, deal: true, property: true }
    });

    let receipt = null;
    if (data.receiptGenerate) {
      receipt = await generatePaymentReceipt(updatedPayment, userId);
    }

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'payment_completed',
        entityType: 'payment',
        entityId: id,
        details: {
          amount: updatedPayment.amount,
          paymentMethod: data.paymentMethod,
          pipelineStage: updatedPayment.pipelineStage,
          leadName: payment.lead?.name
        }
      }
    });

    return res.json({ payment: updatedPayment, receipt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Record Payment Error:', error);
    return res.status(500).json({ error: 'Failed to record payment' });
  }
};

export const getPaymentLedger = async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, dealId } = req.query;
    const { role, userId } = req.user!;

    if (!leadId && !dealId) {
      return res.status(400).json({ error: 'Either leadId or dealId is required' });
    }

    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (dealId) where.dealId = dealId;

    // Agent can only see their own lead's ledger
    if (role === 'agent') {
      where.lead = { assignedToId: userId };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        property: { select: { id: true, title: true } },
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1,
          include: { changedBy: { select: { id: true, fullName: true } } }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = totalAmount - paidAmount;
    const overduePayments = payments.filter(
      p => p.status === 'pending' && p.dueDate && new Date(p.dueDate) < new Date()
    );

    // Stage-wise breakdown
    const stageBreakdown: Record<string, number> = {};
    for (const p of payments) {
      const key = p.pipelineStage || 'unassigned';
      stageBreakdown[key] = (stageBreakdown[key] || 0) + p.amount;
    }

    return res.json({
      payments,
      summary: {
        totalAmount,
        paidAmount,
        pendingAmount,
        overdueCount: overduePayments.length,
        overdueAmount: overduePayments.reduce((sum, p) => sum + p.amount, 0),
        stageBreakdown
      }
    });
  } catch (error) {
    console.error('Get Payment Ledger Error:', error);
    return res.status(500).json({ error: 'Failed to fetch payment ledger' });
  }
};

export const getOverduePayments = async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId } = req.user!;

    const where: any = {
      status: 'pending',
      dueDate: { lt: new Date() }
    };

    if (role === 'agent') {
      where.lead = { assignedToId: userId };
    }

    const overduePayments = await prisma.payment.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true } },
        deal: { select: { id: true, dealValue: true } },
        property: { select: { id: true, title: true } }
      },
      orderBy: { dueDate: 'asc' }
    });

    const groupedByLead = overduePayments.reduce((acc, payment) => {
      const leadId = payment.leadId || 'unknown';
      if (!acc[leadId]) {
        acc[leadId] = { lead: payment.lead, payments: [], totalOverdue: 0 };
      }
      acc[leadId].payments.push(payment);
      acc[leadId].totalOverdue += payment.amount;
      return acc;
    }, {} as Record<string, any>);

    return res.json({
      overduePayments,
      groupedByLead: Object.values(groupedByLead),
      summary: {
        totalOverdueCount: overduePayments.length,
        totalOverdueAmount: overduePayments.reduce((sum, p) => sum + p.amount, 0)
      }
    });
  } catch (error) {
    console.error('Get Overdue Payments Error:', error);
    return res.status(500).json({ error: 'Failed to fetch overdue payments' });
  }
};

export const sendPaymentReminders = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIds } = req.body;
    const { role, userId } = req.user!;

    if (!paymentIds || !Array.isArray(paymentIds)) {
      return res.status(400).json({ error: 'paymentIds array is required' });
    }

    const where: any = {
      id: { in: paymentIds },
      status: 'pending'
    };

    // Agent can only send reminders for their own leads
    if (role === 'agent') {
      where.lead = { assignedToId: userId };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { lead: true }
    });

    const reminders = [];

    for (const payment of payments) {
      const reminder = await prisma.paymentReminder.create({
        data: {
          paymentId: payment.id,
          sentAt: new Date(),
          sentBy: userId,
          reminderType: 'manual',
          status: 'sent'
        }
      });

      reminders.push(reminder);

      await prisma.activityLog.create({
        data: {
          userId,
          action: 'payment_reminder_sent',
          entityType: 'payment',
          entityId: payment.id,
          details: {
            amount: payment.amount,
            pipelineStage: payment.pipelineStage,
            leadName: payment.lead?.name
          }
        }
      });
    }

    return res.json({
      success: true,
      message: `Reminders sent for ${reminders.length} payments`,
      reminders
    });
  } catch (error) {
    console.error('Send Payment Reminders Error:', error);
    return res.status(500).json({ error: 'Failed to send payment reminders' });
  }
};

// ==================== RECEIPT GENERATOR ====================

async function generatePaymentReceipt(payment: any, userId: string) {
  const receiptData = {
    receiptNumber: `REC-${Date.now()}`,
    customerName: payment.lead?.name,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    paymentFor: payment.paymentType.replace(/_/g, ' ').toUpperCase(),
    propertyDetails: payment.property?.title,
    pipelineStage: payment.pipelineStage
  };

  const document = await prisma.document.create({
    data: {
      name: `Receipt_${receiptData.receiptNumber}.pdf`,
      type: 'receipt',
      leadId: payment.leadId || null,
      dealId: payment.dealId || null,
      propertyId: payment.propertyId || null,
      status: 'signed',
      createdBy: userId,
      documentData: receiptData
    }
  });

  return document;
}