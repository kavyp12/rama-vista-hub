import { Response } from 'express';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { ProjectStatus, LeadStage, Temperature, PropertyType, PropertyStatus } from '@prisma/client';

// ✅ CHANGED: Default is now 5000 (Matches your Server's Site Backend Port)
const SITE_API_URL = process.env.SITE_API_URL || 'http://localhost:5001/api';

// --- HELPER TO FETCH DATA & LOG ERRORS ---
// This replaces the .catch() block that was hiding your errors
const fetchFromSite = async (endpoint: string) => {
  try {
    const url = `${SITE_API_URL}${endpoint}`;
    console.log(`👉 Attempting to fetch: ${url}`); // Debug Log
    const response = await axios.get(url);
    
    // Handle both { data: [...] } and [...] formats
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.data)) return response.data.data;
    return [];
    
  } catch (error: any) {
    console.error(`❌ FAILED to fetch ${endpoint}:`, error.message);
    // If there is a response from server (e.g. 404 or 500), log it
    if (error.response) {
      console.error(`   Server Responded: ${error.response.status}`, error.response.data);
    }
    return []; // Return empty array so sync doesn't crash, but we see the error above
  }
};

// ==========================================
// 1. SYNC PROJECTS
// ==========================================
export const syncProjects = async (req: AuthRequest, res: Response) => {
  try {
    console.log(`🔄 Starting Project Sync... Target: ${SITE_API_URL}`);

    // Fetch all 3 categories using the helper
    const [resProjects, commProjects, landProjects] = await Promise.all([
      fetchFromSite('/projects'),
      fetchFromSite('/commercial-projects'),
      fetchFromSite('/land-projects')
    ]);

    const allData = [
      ...resProjects.map((p: any) => ({ ...p, _category: 'residential' })),
      ...commProjects.map((p: any) => ({ ...p, _category: 'commercial' })),
      ...landProjects.map((p: any) => ({ ...p, _category: 'land' }))
    ];

    console.log(`📥 Fetched ${allData.length} total projects from site.`);
    let createdCount = 0;
    let updatedCount = 0;

    const extractNumericPrice = (priceStr: any): number => {
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

      // Price Logic
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
        websiteId: item._id, // Ensure this exists in your schema
        name: item.name || item.title || 'Untitled',
        category: category as any,
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

      // ✅ NO DUPLICATE LOGIC: Update if exists, Create if new
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
    console.error('Project Sync CRITICAL Error:', error);
    return res.status(500).json({ error: 'Sync failed', details: error.message });
  }
};

// ==========================================
// 2. SYNC LEADS
// ==========================================
export const syncLeads = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔄 Starting Lead Sync...');

    const siteLeads = await fetchFromSite('/leads');
    console.log(`📥 Fetched ${siteLeads.length} leads from site.`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const siteLead of siteLeads) {

      let projectId = null;
      let projectNameFromSite = '';

      // Try to find project name from lead data
      if (siteLead.project && siteLead.project.name) {
        projectNameFromSite = siteLead.project.name;
      } else if (siteLead.commercialProject && siteLead.commercialProject.name) {
        projectNameFromSite = siteLead.commercialProject.name;
      }

      // Link lead to CRM project if name matches
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

      // ✅ NO DUPLICATE LOGIC: Check by Phone Number
      const existing = await prisma.lead.findFirst({ where: { phone: siteLead.phone } });

      if (existing) {
        updatedCount++; // Skip or update if needed
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
// 3. SYNC PROPERTIES
// ==========================================
export const syncProperties = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔄 Starting Property Sync from Project Configurations...');

    // Fetch all project types
    const [resProjects, commProjects, landProjects] = await Promise.all([
      fetchFromSite('/projects'),
      fetchFromSite('/commercial-projects'),
      fetchFromSite('/land-projects')
    ]);

    const siteProjects = [
      ...resProjects.map((p: any) => ({ ...p, _category: 'residential' })),
      ...commProjects.map((p: any) => ({ ...p, _category: 'commercial' })),
      ...landProjects.map((p: any) => ({ ...p, _category: 'land' }))
    ];

    console.log(`📥 Processing ${siteProjects.length} projects for properties...`);

    let createdCount = 0;
    let updatedCount = 0;

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

    const mapPropertyType = (type: string, category: string): PropertyType => {
      const t = (type || '').toLowerCase();
      if (category === 'land' || t.includes('plot') || t.includes('land')) return PropertyType.plot;
      if (category === 'commercial' || t.includes('commercial') || t.includes('office')) return PropertyType.commercial;
      if (t.includes('villa')) return PropertyType.villa;
      if (t.includes('penthouse')) return PropertyType.penthouse;
      return PropertyType.apartment;
    };

    for (const siteProject of siteProjects) {
      // Must match a project in CRM first
      const crmProject = await prisma.project.findUnique({
        where: { websiteId: siteProject._id }
      });

      if (!crmProject) {
        continue; // Skip if project not synced yet
      }

      const projectId = crmProject.id;
      const location = siteProject.area || siteProject.location || 'Unknown';
      const city = siteProject.city || null;

      // --- RESIDENTIAL ---
      if (siteProject._category === 'residential' && siteProject.configurations) {
        for (const config of siteProject.configurations) {
          const bhkMatch = config.type?.match(/(\d+(\.\d+)?)\s*BHK/i);
          const bhk = bhkMatch ? parseFloat(bhkMatch[1]) : null;
          const areaMatch = config.area?.match(/([\d,]+)/);
          const area = areaMatch ? parseFloat(areaMatch[1].replace(/,/g, '')) : null;
          const price = extractPrice(config.price);
          const title = `${config.type || 'Unit'} - ${config.area || 'TBD'}`;

          const propertyData = {
            title,
            propertyType: mapPropertyType(config.type, 'residential'),
            location, city, bedrooms: bhk ? Math.floor(bhk) : null, bathrooms: bhk ? Math.floor(bhk) : null,
            areaSqft: area, price: price || 1, status: PropertyStatus.available,
            description: `${config.type} in ${siteProject.name}`,
            projectId, features: [], imageUrls: siteProject.heroImages?.slice(0, 3) || []
          };

          const existing = await prisma.property.findFirst({ where: { projectId, title, areaSqft: area } });
          if (existing) { await prisma.property.update({ where: { id: existing.id }, data: propertyData }); updatedCount++; }
          else { await prisma.property.create({ data: propertyData }); createdCount++; }
        }
      }

      // --- COMMERCIAL ---
      else if (siteProject._category === 'commercial' && siteProject.pricingDetails) {
        for (const pricing of siteProject.pricingDetails) {
          const type = pricing.propertyType || pricing.type || 'Commercial Unit';
          const area = pricing.superBuiltupArea ? parseFloat(pricing.superBuiltupArea) : (pricing.area ? parseFloat(pricing.area) : null);
          const price = extractPrice(pricing.priceDisplay || pricing.price);
          const title = `${type} - ${area || 'Custom'}`;

          const propertyData = {
            title, propertyType: PropertyType.commercial, location, city,
            areaSqft: area, price: price || 1, status: PropertyStatus.available,
            description: `${type} in ${siteProject.name}`, projectId,
            features: [], imageUrls: siteProject.heroImages?.slice(0, 3) || []
          };

          const existing = await prisma.property.findFirst({ where: { projectId, title, areaSqft: area } });
          if (existing) { await prisma.property.update({ where: { id: existing.id }, data: propertyData }); updatedCount++; }
          else { await prisma.property.create({ data: propertyData }); createdCount++; }
        }
      }

      // --- LAND ---
      else if (siteProject._category === 'land') {
        const area = siteProject.plotArea ? parseFloat(siteProject.plotArea) : null;
        const price = extractPrice(siteProject.price);
        const title = `Plot at ${siteProject.village || location}`;

        const propertyData = {
          title, propertyType: PropertyType.plot, location, city,
          areaSqft: area, price: price || 1, status: PropertyStatus.available,
          description: `Land in ${siteProject.village}`, projectId,
          features: [], imageUrls: siteProject.heroImages || []
        };

        const existing = await prisma.property.findFirst({ where: { projectId, title } });
        if (existing) { await prisma.property.update({ where: { id: existing.id }, data: propertyData }); updatedCount++; }
        else { await prisma.property.create({ data: propertyData }); createdCount++; }
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