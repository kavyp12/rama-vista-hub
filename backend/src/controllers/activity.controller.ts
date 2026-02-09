import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId, userId, action } = req.query;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const where: any = {};
    
    if (entityType) where.entityType = entityType as string;
    if (entityId) where.entityId = entityId as string;
    if (userId) where.userId = userId as string;
    if (action) where.action = action as string;

    const activityLogs = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return res.json(activityLogs);
  } catch (error) {
    throw error;
  }
};

export const getActivityLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const activityLog = await prisma.activityLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!activityLog) {
      return res.status(404).json({ error: 'Activity log not found' });
    }

    return res.json(activityLog);
  } catch (error) {
    throw error;
  }
};

export const getRecentActivity = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Get recent activity for current user or all if admin/manager
    const where: any = {};
    
    if (req.user!.role === 'sales_agent') {
      where.userId = req.user!.userId;
    }

    const recentActivity = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return res.json(recentActivity);
  } catch (error) {
    throw error;
  }
};

export const getActivityStats = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }
    
    // If sales agent, only their activities
    if (req.user!.role === 'sales_agent') {
      where.userId = req.user!.userId;
    }

    // Get activity counts by action
    const activityByAction = await prisma.activityLog.groupBy({
      by: ['action'],
      where,
      _count: {
        action: true
      },
      orderBy: {
        _count: {
          action: 'desc'
        }
      }
    });

    // Get activity counts by entity type
    const activityByEntity = await prisma.activityLog.groupBy({
      by: ['entityType'],
      where,
      _count: {
        entityType: true
      },
      orderBy: {
        _count: {
          entityType: 'desc'
        }
      }
    });

    // Get total activities
    const totalActivities = await prisma.activityLog.count({ where });

    // FIX: Typed as 'any' to bypass strict Prisma return type conflicts
    let activityByUser: any = [];

    if (req.user!.role !== 'sales_agent') {
      const groupResult = await prisma.activityLog.groupBy({
        by: ['userId'],
        where,
        _count: {
          userId: true
        },
        orderBy: {
          _count: {
            userId: 'desc'
          }
        },
        take: 10
      });
      activityByUser = groupResult;

      // Get user details
      const userIds = activityByUser.map((a: any) => a.userId).filter(Boolean) as string[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true }
      });

      activityByUser = activityByUser.map((a: any) => ({
        ...a,
        user: users.find(u => u.id === a.userId)
      }));
    }

    return res.json({
      totalActivities,
      activityByAction: activityByAction.map(a => ({
        action: a.action,
        count: a._count.action
      })),
      activityByEntity: activityByEntity.map(a => ({
        entityType: a.entityType,
        count: a._count.entityType
      })),
      activityByUser: activityByUser.map((a: any) => ({
        userId: a.userId,
        user: a.user,
        count: a._count.userId
      }))
    });
  } catch (error) {
    throw error;
  }
};

export const deleteActivityLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete activity logs' });
    }

    await prisma.activityLog.delete({ where: { id } });

    return res.json({ message: 'Activity log deleted successfully' });
  } catch (error) {
    throw error;
  }
};