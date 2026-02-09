import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const createDealSchema = z.object({
  leadId: z.string(),
  propertyId: z.string().optional().nullable(),
  dealValue: z.number(),
  probability: z.number().int().min(0).max(100).optional().nullable(),
  stage: z.enum(['negotiation', 'token', 'documentation', 'closed', 'lost']).default('negotiation'),
  expectedCloseDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable()
});

const updateDealSchema = createDealSchema.partial();

export const getDeals = async (req: AuthRequest, res: Response) => {
  try {
    const { stage, assignedTo } = req.query;
    
    const where: any = {};
    
    if (stage) where.stage = stage;
    if (assignedTo) where.assignedToId = assignedTo;
    
    if (req.user!.role === 'sales_agent') {
      where.assignedToId = req.user!.userId;
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        property: {
          select: {
            id: true,
            title: true,
            location: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(deals);
  } catch (error) {
    throw error;
  }
};

export const getDeal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        lead: true,
        property: true,
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        documents: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (req.user!.role === 'sales_agent' && deal.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(deal);
  } catch (error) {
    throw error;
  }
};

export const createDeal = async (req: AuthRequest, res: Response) => {
  try {
    const data = createDealSchema.parse(req.body);

    const assignedToId = data.assignedToId || req.user!.userId;

    const deal = await prisma.deal.create({
      data: {
        ...data,
        assignedToId,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null
      },
      include: {
        lead: true,
        property: true,
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'deal_created',
        entityType: 'deal',
        entityId: deal.id,
        details: { 
          leadName: deal.lead.name,
          dealValue: deal.dealValue 
        }
      }
    });

    return res.status(201).json(deal);
  } catch (error) {
    throw error;
  }
};

export const updateDeal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateDealSchema.parse(req.body);

    const existingDeal = await prisma.deal.findUnique({ where: { id } });
    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (req.user!.role === 'sales_agent' && existingDeal.assignedToId !== req.user!.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...data,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        closedAt: data.stage === 'closed' ? new Date() : undefined
      },
      include: {
        lead: true,
        property: true,
        assignedTo: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'deal_updated',
        entityType: 'deal',
        entityId: deal.id,
        details: { 
          stage: deal.stage,
          dealValue: deal.dealValue 
        }
      }
    });

    return res.json(deal);
  } catch (error) {
    throw error;
  }
};

export const deleteDeal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role === 'sales_agent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.deal.delete({ where: { id } });

    return res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    throw error;
  }
};