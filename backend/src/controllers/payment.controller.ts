import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

// ==================== SCHEMAS ====================

const createPaymentSchema = z.object({
  leadId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  amount: z.number().positive(),
  paymentType: z.enum(['booking_amount', 'installment', 'down_payment', 'registration', 'other']),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer', 'upi', 'credit_card', 'other']).optional().nullable(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).default('pending'),
  dueDate: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  installmentNumber: z.number().int().optional().nullable(),
  totalInstallments: z.number().int().optional().nullable()
});

const updatePaymentSchema = createPaymentSchema.partial();

// FIXED: Made dealId optional/nullable to match Frontend
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

// ==================== CONTROLLERS ====================

export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { status, leadId, dealId, propertyId, overdueOnly } = req.query;

    const where: any = {};

    if (status) where.status = status;
    if (leadId) where.leadId = leadId;
    if (dealId) where.dealId = dealId;
    if (propertyId) where.propertyId = propertyId;

    // Filter overdue payments
    if (overdueOnly === 'true') {
      where.status = 'pending';
      where.dueDate = {
        lt: new Date()
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        lead: {
          select: { id: true, name: true, phone: true, email: true }
        },
        deal: {
          select: { id: true, dealValue: true, stage: true }
        },
        property: {
          select: { id: true, title: true, location: true, price: true }
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

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        lead: true,
        deal: true,
        property: true
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
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

    const payment = await prisma.payment.create({
      data: {
        leadId: data.leadId || null,
        dealId: data.dealId || null,
        propertyId: data.propertyId || null,
        amount: data.amount,
        paymentType: data.paymentType,
        paymentMethod: data.paymentMethod || null,
        status: data.status,
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

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'payment_recorded',
        entityType: 'payment',
        entityId: payment.id,
        details: {
          amount: payment.amount,
          paymentType: payment.paymentType,
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

    const updateData: any = {};
    if (data.leadId !== undefined) updateData.leadId = data.leadId;
    if (data.dealId !== undefined) updateData.dealId = data.dealId;
    if (data.propertyId !== undefined) updateData.propertyId = data.propertyId;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.paymentType !== undefined) updateData.paymentType = data.paymentType;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.referenceNumber !== undefined) updateData.referenceNumber = data.referenceNumber;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.installmentNumber !== undefined) updateData.installmentNumber = data.installmentNumber;
    if (data.totalInstallments !== undefined) updateData.totalInstallments = data.totalInstallments;
    if (data.status === 'completed') updateData.paidAt = new Date();

    const payment = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        lead: true,
        deal: true,
        property: true
      }
    });

    return res.json(payment);
  } catch (error) {
    console.error('Update Payment Error:', error);
    return res.status(500).json({ error: 'Failed to update payment' });
  }
};

export const deletePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete payments' });
    }

    await prisma.payment.delete({ where: { id } });

    return res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete Payment Error:', error);
    return res.status(500).json({ error: 'Failed to delete payment' });
  }
};

// ==================== PAYMENT SCHEDULE ====================

export const createPaymentSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const data = createPaymentScheduleSchema.parse(req.body);

    // VALIDATE: Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: data.leadId }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // VALIDATE: Check if deal exists (ONLY if dealId is provided)
    if (data.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: data.dealId }
      });

      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }
    }

    // VALIDATE: Check if property exists (if provided)
    if (data.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: data.propertyId }
      });

      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
    }

    const payments = [];

    // Create booking amount payment
    const bookingPayment = await prisma.payment.create({
      data: {
        leadId: data.leadId,
        dealId: data.dealId || null,
        propertyId: data.propertyId || null,
        amount: data.bookingAmount,
        paymentType: 'booking_amount',
        status: 'pending',
        dueDate: new Date(),
        installmentNumber: 0,
        totalInstallments: data.installments.length
      }
    });
    payments.push(bookingPayment);

    // Create installment payments
    for (let i = 0; i < data.installments.length; i++) {
      const installment = data.installments[i];

      const payment = await prisma.payment.create({
        data: {
          leadId: data.leadId,
          dealId: data.dealId || null,
          propertyId: data.propertyId || null,
          amount: installment.amount,
          paymentType: 'installment',
          status: 'pending',
          dueDate: new Date(installment.dueDate),
          notes: installment.description,
          installmentNumber: i + 1,
          totalInstallments: data.installments.length
        }
      });
      payments.push(payment);
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'payment_schedule_created',
        entityType: 'payment',
        entityId: bookingPayment.id,
        details: {
          totalAmount: data.totalAmount,
          bookingAmount: data.bookingAmount,
          installmentsCount: data.installments.length
        }
      }
    });

    return res.status(201).json({
      message: 'Payment schedule created successfully',
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

// ... (Rest of the file remains unchanged: recordPayment, getPaymentLedger, etc.)
// Re-exporting the rest of the functions just to be complete if you copy-paste
// You can keep the existing code for recordPayment, getPaymentLedger, getOverduePayments, sendPaymentReminders
// as they were not causing issues.
export const recordPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = recordPaymentSchema.parse(req.body);

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { lead: true, property: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status === 'completed') {
      return res.status(400).json({ error: 'Payment already completed' });
    }

    // Update payment
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status: 'completed',
        paidAt: new Date(),
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        notes: data.notes
      },
      include: {
        lead: true,
        deal: true,
        property: true
      }
    });

    // Generate receipt if requested
    let receipt = null;
    if (data.receiptGenerate) {
      receipt = await generatePaymentReceipt(updatedPayment, req.user!.userId);
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'payment_completed',
        entityType: 'payment',
        entityId: id,
        details: {
          amount: updatedPayment.amount,
          paymentMethod: data.paymentMethod,
          leadName: payment.lead?.name
        }
      }
    });

    return res.json({
      payment: updatedPayment,
      receipt
    });
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

    if (!leadId && !dealId) {
      return res.status(400).json({ error: 'Either leadId or dealId is required' });
    }

    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (dealId) where.dealId = dealId;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        lead: {
          select: { id: true, name: true, phone: true }
        },
        property: {
          select: { id: true, title: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = totalAmount - paidAmount;
    const overduePayments = payments.filter(
      p => p.status === 'pending' && p.dueDate && new Date(p.dueDate) < new Date()
    );

    return res.json({
      payments,
      summary: {
        totalAmount,
        paidAmount,
        pendingAmount,
        overdueCount: overduePayments.length,
        overdueAmount: overduePayments.reduce((sum, p) => sum + p.amount, 0)
      }
    });
  } catch (error) {
    console.error('Get Payment Ledger Error:', error);
    return res.status(500).json({ error: 'Failed to fetch payment ledger' });
  }
};

export const getOverduePayments = async (_req: AuthRequest, res: Response) => {
  try {
    const overduePayments = await prisma.payment.findMany({
      where: {
        status: 'pending',
        dueDate: {
          lt: new Date()
        }
      },
      include: {
        lead: {
          select: { id: true, name: true, phone: true, email: true }
        },
        deal: {
          select: { id: true, dealValue: true }
        },
        property: {
          select: { id: true, title: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    // Group by lead
    const groupedByLead = overduePayments.reduce((acc, payment) => {
      const leadId = payment.leadId || 'unknown';
      if (!acc[leadId]) {
        acc[leadId] = {
          lead: payment.lead,
          payments: [],
          totalOverdue: 0
        };
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

    if (!paymentIds || !Array.isArray(paymentIds)) {
      return res.status(400).json({ error: 'paymentIds array is required' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        id: { in: paymentIds },
        status: 'pending'
      },
      include: {
        lead: true
      }
    });

    const reminders = [];

    for (const payment of payments) {
      const reminder = await prisma.paymentReminder.create({
        data: {
          paymentId: payment.id,
          sentAt: new Date(),
          sentBy: req.user!.userId,
          reminderType: 'manual',
          status: 'sent'
        }
      });

      reminders.push(reminder);

      await prisma.activityLog.create({
        data: {
          userId: req.user!.userId,
          action: 'payment_reminder_sent',
          entityType: 'payment',
          entityId: payment.id,
          details: {
            amount: payment.amount,
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

async function generatePaymentReceipt(payment: any, userId: string) {
  const receiptData = {
    receiptNumber: `REC-${Date.now()}`,
    customerName: payment.lead?.name,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    paymentFor: payment.paymentType.replace(/_/g, ' ').toUpperCase(),
    propertyDetails: payment.property?.title
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