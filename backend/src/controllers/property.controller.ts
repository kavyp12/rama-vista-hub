import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { PropertyStatus, PropertyType } from '@prisma/client';

const createPropertySchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  status: z.nativeEnum(PropertyStatus).default(PropertyStatus.available),
  propertyType: z.nativeEnum(PropertyType), 
  location: z.string(),
  city: z.string().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
  areaSqft: z.number().positive().optional(),
  features: z.array(z.string()).default([]), 
  imageUrls: z.array(z.string()).default([]),
  projectId: z.string().optional(),
});

const updatePropertySchema = createPropertySchema.partial();

export const getProperties = async (req: AuthRequest, res: Response) => {
  try {
    const { status, projectId, minPrice, maxPrice } = req.query;
    
    const where: any = {};
    
    if (status) where.status = status as PropertyStatus;
    if (projectId) where.projectId = projectId as string;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    const properties = await prisma.property.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            location: true,
            city: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(properties);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch properties' });
  }
};

export const getProperty = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        project: true,
        deals: true
      }
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    return res.json(property);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch property' });
  }
};

export const createProperty = async (req: AuthRequest, res: Response) => {
  try {
    const data = createPropertySchema.parse(req.body);

    const property = await prisma.property.create({
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        status: data.status,
        propertyType: data.propertyType,
        location: data.location,
        city: data.city,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        areaSqft: data.areaSqft,
        features: data.features,
        imageUrls: data.imageUrls,
        projectId: data.projectId || undefined, 
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'property_created',
        entityType: 'property',
        entityId: property.id,
        details: { propertyTitle: property.title }
      }
    });

    return res.status(201).json(property);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create Property Error:', error);
    return res.status(500).json({ error: 'Failed to create property' });
  }
};

export const updateProperty = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updatePropertySchema.parse(req.body);

    const property = await prisma.property.update({
      where: { id },
      data: {
        ...data,
        projectId: data.projectId || undefined
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'property_updated',
        entityType: 'property',
        entityId: property.id,
        details: { propertyTitle: property.title }
      }
    });

    return res.json(property);
  } catch (error) {
    console.error('Update Property Error:', error);
    return res.status(500).json({ error: 'Failed to update property' });
  }
};

export const deleteProperty = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete properties' });
    }

    await prisma.property.delete({ where: { id } });

    return res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete property' });
  }
};