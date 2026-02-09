import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

// 1. UPDATED SCHEMA: Includes Category & Land/Commercial Fields
const createProjectSchema = z.object({
  // Common Fields
  name: z.string().min(2),
  category: z.enum(['residential', 'commercial', 'land']).default('residential'), // 🆕
  location: z.string(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'upcoming', 'completed', 'on_hold']).default('active'),
  amenities: z.array(z.string()).default([]),
  imageUrls: z.array(z.string()).default([]),
  
  // Residential / Commercial Common
  developer: z.string().optional().nullable(),
  minPrice: z.number().optional().nullable(),
  maxPrice: z.number().optional().nullable(),
  totalUnits: z.number().int().optional().nullable(),
  availableUnits: z.number().int().optional().nullable(),

  // Commercial Specific
  propertyType: z.string().optional().nullable(),
  transactionType: z.string().optional().nullable(),

  // Land Specific
  village: z.string().optional().nullable(),
  taluka: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  plotArea: z.number().optional().nullable(),
  surveyNumber: z.string().optional().nullable(),
});

const updateProjectSchema = createProjectSchema.partial();

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { status, city, category } = req.query; // Added category filter
    
    const where: any = {};
    
    if (status) where.status = status;
    if (city) where.city = city;
    if (category) where.category = category; // Filter by category

    const projects = await prisma.project.findMany({
      where,
      include: {
        properties: {
          select: {
            id: true,
            title: true,
            status: true,
            price: true
          }
        },
        _count: {
          select: {
            properties: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(projects);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const getProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        properties: true,
        siteVisits: {
          include: {
            lead: {
              select: {
                id: true,
                name: true,
                phone: true
              }
            }
          },
          orderBy: { scheduledAt: 'desc' }
        },
        _count: {
          select: {
            properties: true,
            siteVisits: true
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json(project);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const data = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'project_created',
        entityType: 'project',
        entityId: project.id,
        details: { projectName: project.name, category: project.category }
      }
    });

    return res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateProjectSchema.parse(req.body);

    const project = await prisma.project.update({
      where: { id },
      data
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'project_updated',
        entityType: 'project',
        entityId: project.id,
        details: { projectName: project.name }
      }
    });

    return res.json(project);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete projects' });
    }

    await prisma.project.delete({ where: { id } });

    return res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
};