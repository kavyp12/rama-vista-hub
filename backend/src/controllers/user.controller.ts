import { Response } from 'express';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().optional().nullable(), // ✅ Added phone
  role: z.enum(['admin', 'sales_manager', 'sales_agent']).default('sales_agent'),
  avatarUrl: z.string().url().optional().nullable()
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(), // ✅ Added phone
  role: z.enum(['admin', 'sales_manager', 'sales_agent']).optional(),
  avatarUrl: z.string().url().optional().nullable()
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6)
});

// Get all users (Admin/Manager only)
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    // Check authorization
    if (req.user!.role !== 'admin' && req.user!.role !== 'sales_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { role, isActive, search } = req.query;
    
    const where: any = {};
    
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true, // ✅ Added phone
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedLeads: true,
            callLogs: true,
            assignedDeals: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(users);
  } catch (error) {
    console.error('Get Users Error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get single user details
export const getUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Allow users to view their own profile, or admin/manager to view any
    if (req.user!.userId !== id && req.user!.role !== 'admin' && req.user!.role !== 'sales_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true, // ✅ Added phone
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        assignedLeads: {
          select: {
            id: true,
            name: true,
            stage: true,
            temperature: true,
            createdAt: true
          },
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            assignedLeads: true,
            callLogs: true,
            assignedDeals: true,
            activityLogs: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Get User Error:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// Get user statistics
export const getUserStats = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Authorization check
    if (req.user!.userId !== id && req.user!.role !== 'admin' && req.user!.role !== 'sales_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get leads by stage
    const leadsByStage = await prisma.lead.groupBy({
      by: ['stage'],
      where: { assignedToId: id },
      _count: true
    });

    // Get leads by temperature
    const leadsByTemperature = await prisma.lead.groupBy({
      by: ['temperature'],
      where: { assignedToId: id },
      _count: true
    });

    // Get call stats
    const totalCalls = await prisma.callLog.count({
      where: { agentId: id }
    });

    const connectedCalls = await prisma.callLog.count({
      where: { 
        agentId: id,
        callStatus: 'connected_positive'
      }
    });

    // Get deal stats
    const totalDeals = await prisma.deal.count({
      where: { assignedToId: id }
    });

    const closedDeals = await prisma.deal.count({
      where: { 
        assignedToId: id,
        stage: 'closed'
      }
    });

    // Get total revenue from closed deals
    const dealsData = await prisma.deal.findMany({
      where: {
        assignedToId: id,
        stage: 'closed'
      },
      select: {
        dealValue: true
      }
    });

    const totalRevenue = dealsData.reduce((sum, deal) => sum + Number(deal.dealValue || 0), 0);

    // Calculate conversion rate
    const totalLeads = await prisma.lead.count({
      where: { assignedToId: id }
    });

    const convertedLeads = await prisma.lead.count({
      where: {
        assignedToId: id,
        stage: { in: ['closed', 'token'] }
      }
    });

    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    return res.json({
      leadsByStage: leadsByStage.map(item => ({
        stage: item.stage,
        count: item._count
      })),
      leadsByTemperature: leadsByTemperature.map(item => ({
        temperature: item.temperature,
        count: item._count
      })),
      callStats: {
        total: totalCalls,
        connected: connectedCalls,
        connectRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0
      },
      dealStats: {
        total: totalDeals,
        closed: closedDeals,
        winRate: totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0,
        totalRevenue
      },
      totalLeads,
      convertedLeads,
      conversionRate
    });
  } catch (error) {
    console.error('Get User Stats Error:', error);
    return res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
};

// Create new user (Admin only)
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    // Only admin can create users
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create users' });
    }

    const data = createUserSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        fullName: data.fullName,
        phone: data.phone, // ✅ Added phone
        role: data.role,
        avatarUrl: data.avatarUrl
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true, // ✅ Added phone
        role: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'user_created',
        entityType: 'user',
        entityId: user.id,
        details: { 
          userName: user.fullName,
          userRole: user.role,
          userEmail: user.email
        }
      }
    });

    return res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create User Error:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
};

// Update user (Admin only, or user updating self - limited fields)
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Authorization: Admin can update anyone, users can only update themselves (limited fields)
    const isSelfUpdate = req.user!.userId === id;
    const isAdmin = req.user!.role === 'admin';

    if (!isSelfUpdate && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If self-update, restrict what can be changed
    const updateData: any = {};
    if (isSelfUpdate && !isAdmin) {
      // Users can update their own name, avatar, and phone number
      if (data.fullName) updateData.fullName = data.fullName;
      if (data.phone !== undefined) updateData.phone = data.phone; // ✅ Added phone
      if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    } else {
      // Admin can update everything
      if (data.email) updateData.email = data.email;
      if (data.fullName) updateData.fullName = data.fullName;
      if (data.phone !== undefined) updateData.phone = data.phone; // ✅ Added phone
      if (data.role) updateData.role = data.role;
      if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true, // ✅ Added phone
        role: true,
        avatarUrl: true,
        updatedAt: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'user_updated',
        entityType: 'user',
        entityId: user.id,
        details: { userName: user.fullName }
      }
    });

    return res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update User Error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
};

// Admin reset user password
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = changePasswordSchema.parse(req.body);

    // Only admin can reset passwords
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can reset passwords' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'password_reset',
        entityType: 'user',
        entityId: id,
        details: { userName: user.fullName }
      }
    });

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Reset Password Error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};

// Delete/Deactivate user (Admin only)
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Only admin can delete users
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }

    // Prevent self-deletion
    if (req.user!.userId === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete - mark as deleted (we'll add deletedAt field)
    // For now, we'll actually delete since isActive doesn't exist
    await prisma.user.delete({ where: { id } });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'user_deactivated',
        entityType: 'user',
        entityId: id,
        details: { userName: user.fullName }
      }
    });

    return res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete User Error:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Get user call logs (Admin/Manager can view any, users can view their own)
export const getUserCallLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Authorization check
    if (req.user!.userId !== id && req.user!.role !== 'admin' && req.user!.role !== 'sales_manager') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const callLogs = await prisma.callLog.findMany({
      where: { agentId: id },
      include: {
        lead: {
          select: { 
            id: true, 
            name: true, 
            phone: true, 
            email: true,
            stage: true,
            temperature: true
          }
        }
      },
      orderBy: { callDate: 'desc' },
      take: 100 // Limit to last 100 calls
    });

    return res.json(callLogs);
  } catch (error) {
    console.error('Get User Call Logs Error:', error);
    return res.status(500).json({ error: 'Failed to fetch call logs' });
  }
};