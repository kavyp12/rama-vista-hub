import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const createBrokerSchema = z.object({
  name: z.string().min(2),
  agencyName: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(10),
  reraId: z.string().optional(),
  location: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional()
});

export const getBrokers = async (_req: AuthRequest, res: Response) => {
  try {
    const brokers = await prisma.broker.findMany({
      include: {
        _count: {
          select: { leads: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(brokers);
  } catch (error) {
    console.error('Get Brokers Error:', error);
    return res.status(500).json({ error: 'Failed to fetch brokers' });
  }
};

export const createBroker = async (req: AuthRequest, res: Response) => {
  try {
    const data = createBrokerSchema.parse(req.body);
    
    // Check for duplicate phone
    const existing = await prisma.broker.findUnique({ where: { phone: data.phone } });
    if (existing) return res.status(400).json({ error: 'Broker with this phone already exists' });

    const broker = await prisma.broker.create({ data });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'broker_created',
        entityType: 'broker',
        entityId: broker.id,
        details: { name: broker.name }
      }
    });

    return res.status(201).json(broker);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create Broker Error:', error);
    return res.status(500).json({ error: 'Failed to create broker' });
  }
};

export const deleteBroker = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.broker.delete({ where: { id } });
    return res.json({ message: 'Broker deleted' });
  } catch (error) {
    console.error('Delete Broker Error:', error);
    return res.status(500).json({ error: 'Failed to delete broker' });
  }
};