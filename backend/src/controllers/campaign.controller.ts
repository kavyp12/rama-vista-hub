import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const createCampaignSchema = z.object({
  name: z.string(),
  type: z.string(),
  status: z.enum(['draft', 'scheduled', 'active', 'completed', 'paused']).default('draft'),
  targetAudience: z.string().optional().nullable(),
  messageTemplate: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable()
});

const updateCampaignSchema = createCampaignSchema.partial().extend({
  sentCount: z.number().int().optional(),
  openedCount: z.number().int().optional(),
  clickedCount: z.number().int().optional(),
  convertedCount: z.number().int().optional()
});

export const getCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const { status, type } = req.query;
    
    const where: any = {};
    
    if (status) where.status = status;
    if (type) where.type = type;

    const campaigns = await prisma.marketingCampaign.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(campaigns);
  } catch (error) {
    throw error;
  }
};

export const getCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    return res.json(campaign);
  } catch (error) {
    throw error;
  }
};

export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const data = createCampaignSchema.parse(req.body);

    const campaign = await prisma.marketingCampaign.create({
      data: {
        ...data,
        createdBy: req.user!.userId,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null
      },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    return res.status(201).json(campaign);
  } catch (error) {
    throw error;
  }
};

export const updateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateCampaignSchema.parse(req.body);

    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined
      },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    });

    return res.json(campaign);
  } catch (error) {
    throw error;
  }
};

export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.marketingCampaign.delete({ where: { id } });

    return res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    throw error;
  }
};