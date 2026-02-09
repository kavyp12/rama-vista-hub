import { Response } from 'express';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ProjectStatus, LeadStage, Temperature, PropertyType, PropertyStatus } from '@prisma/client';

const SITE_API_URL = process.env.SITE_API_URL || 'http://localhost:5001/api';

// ==========================================
// 1. SYNC PROJECTS
// ==========================================
export const syncProjects = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔄 Starting Project Sync...');

    const [resProjects, commProjects, landProjects] = await Promise.all([
      axios.get(`${SITE_API_URL}/projects`).catch(() => ({ data: { data: [] } })),
      axios.get(`${SITE_API_URL}/commercial-projects`).catch(() => ({ data: { data: [] } })),
      axios.get(`${SITE_API_URL}/land-projects`).catch(() => ({ data: { data: [] } }))
    ]);

    const allData = [
      ...(resProjects.data.data || []).map((p: any) => ({ ...p, _category: 'residential' })),
      ...(commProjects.data.data || []).map((p: any) => ({ ...p, _category: 'commercial' })),
      ...(landProjects.data.data || []).map((p: any) => ({ ...p, _category: 'land' }))
    ];

    console.log(`📥 Fetched ${allData.length} projects from site.`);
    let createdCount = 0;
    let updatedCount = 0;

    const extractNumericPrice = (priceStr: string): number => {
      if (!priceStr || typeof priceStr !== 'string') return 0;
      const crMatch = priceStr.match(/([\d.]+)\s*Cr/i);
      const lMatch = priceStr.match(/([\d.]+)\s*L/i);
      const numMatch = priceStr.match(/([\d,]+)/);
      if (crMatch) return parseFloat(crMatch[1]) * 10000000;
      if (lMatch) return parseFloat(lMatch[1]) * 100000;
      if (numMatch) return parseFloat(numMatch[1].replace(/,/g, ''));
      return 0;
    };

    for (const item of allData) {
      const category = item._category;
      let minPrice = 0;
      let maxPrice = 0;
      let priceDisplay = item.priceDisplay || item.priceRange || 'On Request';

      if (item.price) minPrice = Number(item.price);
      else if (item.priceRange) {
        priceDisplay = item.priceRange;
        const parts = item.priceRange.split('-');
        minPrice = extractNumericPrice(parts[0]);
        if (parts.length > 1) maxPrice = extractNumericPrice(parts[1]);
      } else if (item.pricingDetails?.[0]) {
        minPrice = extractNumericPrice(item.pricingDetails[0].priceDisplay);
      }

      const projectData = {
        websiteId: item._id,
        name: item.name || item.title || 'Untitled',
        category: category as any,

        // 🔧 FIXED: Proper location hierarchy
        location: item.area || item.location || item.address || item.village || 'Unknown',
        city: item.city || item.district || null,
        state: item.state || 'Gujarat',

        status: ProjectStatus.active,
        description: item.description || item.about || '',
        imageUrls: item.heroImages || item.images || [],
        amenities: item.amenities?.map((a: any) => typeof a === 'string' ? a : a.name) || [],
        minPrice: minPrice || null,
        maxPrice: maxPrice || null,
        priceDisplay: priceDisplay,
        developer: item.developer || item.ownerName || null,
        totalUnits: item.overview?.totalUnits ? Number(item.overview.totalUnits) : null,
        availableUnits: item.overview?.totalUnits ? Number(item.overview.totalUnits) : null,
        plotArea: item.plotArea ? Number(item.plotArea) : null,
        surveyNumber: item.surveyNumber || null,
        transactionType: item.transactionType || null,
        propertyType: item.propertyType || null,
        village: item.village || null,
        taluka: item.taluka || null,
        district: item.district || null
      };

      const existing = await prisma.project.findUnique({ where: { websiteId: item._id } });

      if (existing) {
        await prisma.project.update({ where: { id: existing.id }, data: projectData });
        updatedCount++;
      } else {
        await prisma.project.create({ data: projectData });
        createdCount++;
      }
    }

    if (req.user) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          action: 'sync_projects',
          entityType: 'system',
          details: { created: createdCount, updated: updatedCount }
        }
      });
    }

    return res.json({
      success: true,
      message: `Projects Synced: ${createdCount} New, ${updatedCount} Updated`
    });

  } catch (error: any) {
    console.error('Project Sync Error:', error);
    return res.status(500).json({ error: 'Sync failed', details: error.message });
  }
};

// ==========================================
// 2. SYNC LEADS
// ==========================================
export const syncLeads = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔄 Starting Lead Sync...');

    const response = await axios.get(`${SITE_API_URL}/leads`);
    const siteLeads = response.data.data || [];

    console.log(`📥 Fetched ${siteLeads.length} leads from site.`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const siteLead of siteLeads) {

      let projectId = null;
      let projectNameFromSite = '';

      if (siteLead.project && siteLead.project.name) {
        projectNameFromSite = siteLead.project.name;
      } else if (siteLead.commercialProject && siteLead.commercialProject.name) {
        projectNameFromSite = siteLead.commercialProject.name;
      }

      if (projectNameFromSite) {
        const match = await prisma.project.findFirst({
          where: { name: { contains: projectNameFromSite, mode: 'insensitive' } }
        });
        if (match) projectId = match.id;
      }

      const mappedStage = mapStage(siteLead.status) as LeadStage;
      const mappedTemp = 'warm' as Temperature;

      const leadData = {
        name: siteLead.name,
        email: siteLead.email || null,
        phone: siteLead.phone,
        source: siteLead.source || 'Website Import',
        stage: mappedStage,
        temperature: mappedTemp,
        projectId: projectId,
        notes: [
          siteLead.message ? `Msg: ${siteLead.message}` : null,
          siteLead.leadType ? `Type: ${siteLead.leadType}` : null,
          projectNameFromSite && !projectId ? `Interested in: ${projectNameFromSite} (Not found in CRM)` : null
        ].filter(Boolean).join(' | '),
        assignedToId: req.user?.userId ?? null
      };

      const existing = await prisma.lead.findFirst({ where: { phone: siteLead.phone } });

      if (existing) {
        updatedCount++;
      } else {
        await prisma.lead.create({ data: leadData });
        createdCount++;
      }
    }

    if (req.user) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          action: 'sync_leads',
          entityType: 'system',
          details: { created: createdCount, found: siteLeads.length }
        }
      });
    }

    return res.json({
      success: true,
      message: `Leads Synced: ${createdCount} New, ${updatedCount} Existing skipped`
    });

  } catch (error: any) {
    console.error('Lead Sync Error:', error);
    return res.status(500).json({ error: 'Sync failed', details: error.message });
  }
};

// ==========================================
// 3. SYNC PROPERTIES (FROM PROJECT CONFIGURATIONS)
// ==========================================
export const syncProperties = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔄 Starting Property Sync from Project Configurations...');

    // Fetch all projects from site API
    const [resProjects, commProjects, landProjects] = await Promise.all([
      axios.get(`${SITE_API_URL}/projects`).catch(() => ({ data: { data: [] } })),
      axios.get(`${SITE_API_URL}/commercial-projects`).catch(() => ({ data: { data: [] } })),
      axios.get(`${SITE_API_URL}/land-projects`).catch(() => ({ data: { data: [] } }))
    ]);

    const siteProjects = [
      ...(resProjects.data.data || []).map((p: any) => ({ ...p, _category: 'residential' })),
      ...(commProjects.data.data || []).map((p: any) => ({ ...p, _category: 'commercial' })),
      ...(landProjects.data.data || []).map((p: any) => ({ ...p, _category: 'land' }))
    ];

    console.log(`📥 Processing ${siteProjects.length} projects for property extraction...`);

    let createdCount = 0;
    let updatedCount = 0;

    // Helper to extract numeric price
    const extractPrice = (str: any): number => {
      if (!str) return 0;
      if (typeof str === 'number') return str;

      const text = str.toString();
      const crMatch = text.match(/([\d.]+)\s*Cr/i);
      const lMatch = text.match(/([\d.]+)\s*L/i);
      const numMatch = text.match(/([\d,]+)/);

      if (crMatch) return parseFloat(crMatch[1]) * 10000000;
      if (lMatch) return parseFloat(lMatch[1]) * 100000;
      if (numMatch) return parseFloat(numMatch[1].replace(/,/g, ''));

      return 0;
    };

    // Helper to map property type
    const mapPropertyType = (type: string, category: string): PropertyType => {
      const t = (type || '').toLowerCase();

      if (category === 'land' || t.includes('plot') || t.includes('land')) {
        return PropertyType.plot;
      }

      if (category === 'commercial' || t.includes('commercial') || t.includes('office') || t.includes('shop') || t.includes('showroom')) {
        return PropertyType.commercial;
      }

      // Residential types
      if (t.includes('villa')) return PropertyType.villa;
      if (t.includes('penthouse')) return PropertyType.penthouse;
      if (t.includes('townhouse')) return PropertyType.townhouse;

      return PropertyType.apartment; // Default
    };

    for (const siteProject of siteProjects) {
      // Find matching project in CRM
      const crmProject = await prisma.project.findUnique({
        where: { websiteId: siteProject._id }
      });

      if (!crmProject) {
        console.log(`⚠️ Skipping properties for project ${siteProject.name} - not synced to CRM yet`);
        continue;
      }

      const projectId = crmProject.id;

      // 🔧 FIXED: Use proper location hierarchy from site project
      const location = siteProject.area || siteProject.location || siteProject.address || siteProject.village || 'Unknown Location';
      const city = siteProject.city || siteProject.district || null;

      // --- RESIDENTIAL: Extract from CONFIGURATIONS ---
      if (siteProject._category === 'residential' && siteProject.configurations) {
        for (const config of siteProject.configurations) {
          // Extract BHK (e.g., "3 BHK Flat" -> 3)
          const bhkMatch = config.type?.match(/(\d+(\.\d+)?)\s*BHK/i);
          const bhk = bhkMatch ? parseFloat(bhkMatch[1]) : null;

          // Extract area (e.g., "1200 Sq.Ft" -> 1200)
          const areaMatch = config.area?.match(/([\d,]+)/);
          const area = areaMatch ? parseFloat(areaMatch[1].replace(/,/g, '')) : null;

          const price = extractPrice(config.price);

          // Generate unique title
          const title = `${config.type || 'Unit'} - ${config.area || 'TBD'}`;

          const propertyData = {
            title,
            propertyType: mapPropertyType(config.type, 'residential'),
            location,
            city,
            bedrooms: bhk ? Math.floor(bhk) : null,
            bathrooms: bhk ? Math.floor(bhk) : null,
            areaSqft: area,
            price: price || 1,
            status: PropertyStatus.available,
            description: `${config.type} in ${siteProject.name}`,
            features: [],
            imageUrls: siteProject.heroImages?.slice(0, 3) || [],
            projectId
          };

          // Check if property already exists
          const existing = await prisma.property.findFirst({
            where: {
              projectId,
              title,
              areaSqft: area
            }
          });

          if (existing) {
            await prisma.property.update({ where: { id: existing.id }, data: propertyData });
            updatedCount++;
          } else {
            await prisma.property.create({ data: propertyData });
            createdCount++;
          }
        }
      }

      // --- COMMERCIAL: Extract from PRICING DETAILS ---
      else if (siteProject._category === 'commercial' && siteProject.pricingDetails) {
        for (const pricing of siteProject.pricingDetails) {
          const type = pricing.propertyType || pricing.type || 'Commercial Unit';

          // Extract area
          const superArea = pricing.superBuiltupArea ? parseFloat(pricing.superBuiltupArea) : null;
          const carpetArea = pricing.carpetArea ? parseFloat(pricing.carpetArea) : null;
          const area = superArea || carpetArea || (pricing.area ? parseFloat(pricing.area) : null);

          // Extract price
          const price = extractPrice(pricing.priceDisplay || pricing.price || pricing.rentLeaseAmount);

          const title = `${type} - ${pricing.superBuiltupArea || pricing.carpetArea || pricing.area || 'Custom'}`;

          const propertyData = {
            title,
            propertyType: PropertyType.commercial,
            location,
            city,
            bedrooms: null,
            bathrooms: pricing.washrooms ? parseInt(pricing.washrooms) : null,
            areaSqft: area,
            price: price || 1,
            status: PropertyStatus.available,
            description: `${type} in ${siteProject.name}`,
            features: [],
            imageUrls: siteProject.heroImages?.slice(0, 3) || [],
            projectId
          };

          const existing = await prisma.property.findFirst({
            where: {
              projectId,
              title,
              areaSqft: area
            }
          });

          if (existing) {
            await prisma.property.update({ where: { id: existing.id }, data: propertyData });
            updatedCount++;
          } else {
            await prisma.property.create({ data: propertyData });
            createdCount++;
          }
        }
      }

      // --- LAND: Create single property entry ---
      else if (siteProject._category === 'land') {
        const area = siteProject.plotArea ? parseFloat(siteProject.plotArea) : null;
        const price = extractPrice(siteProject.price);

        const title = `Plot at ${siteProject.village || location} - ${siteProject.plotArea || ''} ${siteProject.areaUnit || ''}`.trim();

        const propertyData = {
          title,
          propertyType: PropertyType.plot,
          location: siteProject.village || location,
          city: siteProject.district || city,
          bedrooms: null,
          bathrooms: null,
          areaSqft: area,
          price: price || 1,
          status: PropertyStatus.available,
          description: `Land in ${siteProject.village}. Survey: ${siteProject.surveyNumber || 'N/A'}`,
          features: [],
          imageUrls: siteProject.heroImages || siteProject.images || [],
          projectId
        };

        const existing = await prisma.property.findFirst({
          where: {
            projectId,
            title
          }
        });

        if (existing) {
          await prisma.property.update({ where: { id: existing.id }, data: propertyData });
          updatedCount++;
        } else {
          await prisma.property.create({ data: propertyData });
          createdCount++;
        }
      }
    }

    if (req.user) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          action: 'sync_properties',
          entityType: 'system',
          details: { created: createdCount, updated: updatedCount }
        }
      });
    }

    return res.json({
      success: true,
      message: `Properties Synced: ${createdCount} New, ${updatedCount} Updated`
    });

  } catch (error: any) {
    console.error('Property Sync Error:', error);
    return res.status(500).json({ error: 'Sync failed', details: error.message });
  }
};

// Helper function
function mapStage(siteStatus: string): string {
  switch (siteStatus?.toLowerCase()) {
    case 'consulted': return 'contacted';
    case 'pending': return 'negotiation';
    case 'closed': return 'closed';
    default: return 'new';
  }
}