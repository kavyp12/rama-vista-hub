import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// ==================== SCHEMAS ====================

const createDocumentSchema = z.object({
  name: z.string(),
  type: z.enum(['quotation', 'proposal', 'booking_form', 'agreement', 'receipt', 'invoice', 'other']),
  templateType: z.enum(['quotation', 'proposal', 'booking_form', 'sale_agreement', 'receipt', 'custom']).optional(),
  fileUrl: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  status: z.enum(['draft', 'pending_signature', 'signed', 'expired', 'sent']).default('draft'),
  expiresAt: z.string().optional().nullable(),

  // Document data for template generation
  documentData: z.object({
    customerName: z.string().optional(),
    customerEmail: z.string().optional(),
    customerPhone: z.string().optional(),
    propertyDetails: z.string().optional(),
    amount: z.number().optional(),
    discount: z.number().optional(),
    tax: z.number().optional(),
    totalAmount: z.number().optional(),
    paymentTerms: z.string().optional(),
    additionalTerms: z.string().optional(),
    validUntil: z.string().optional(),
  }).optional()
});

const updateDocumentSchema = createDocumentSchema.partial();

const signDocumentSchema = z.object({
  signatureData: z.string(), // Base64 signature image
  signerName: z.string(),
  signerRole: z.string().optional(),
  ipAddress: z.string().optional()
});

const generateDocumentSchema = z.object({
  templateType: z.enum(['quotation', 'proposal', 'booking_form', 'sale_agreement', 'receipt']),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  propertyId: z.string().optional(),
  data: z.record(z.any())
});

// ==================== CONTROLLERS ====================

export const getDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { type, status, leadId, dealId, propertyId } = req.query;

    const where: any = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (leadId) where.leadId = leadId;
    if (dealId) where.dealId = dealId;
    if (propertyId) where.propertyId = propertyId;

    const documents = await prisma.document.findMany({
      where,
      include: {
        lead: {
          select: { id: true, name: true, phone: true, email: true }
        },
        property: {
          select: { id: true, title: true, location: true, price: true }
        },
        project: {
          select: { id: true, name: true, location: true }
        },
        deal: {
          select: { id: true, dealValue: true, stage: true }
        },
        creator: {
          select: { id: true, fullName: true, email: true }
        },
        signatures: {
          include: {
            signer: {
              select: { id: true, fullName: true, email: true }
            }
          },
          orderBy: { signedAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(documents);
  } catch (error) {
    console.error('Get Documents Error:', error);
    return res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

export const getDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        lead: true,
        property: true,
        project: true,
        deal: true,
        creator: {
          select: { id: true, fullName: true, email: true }
        },
        signatures: {
          include: {
            signer: {
              select: { id: true, fullName: true, email: true }
            }
          },
          orderBy: { signedAt: 'desc' }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.json(document);
  } catch (error) {
    console.error('Get Document Error:', error);
    return res.status(500).json({ error: 'Failed to fetch document' });
  }
};

export const createDocument = async (req: AuthRequest, res: Response) => {
  try {
    const data = createDocumentSchema.parse(req.body);

    const document = await prisma.document.create({
      data: {
        name: data.name,
        type: data.type,
        fileUrl: data.fileUrl || null,
        leadId: data.leadId || null,
        propertyId: data.propertyId || null,
        projectId: data.projectId || null,
        dealId: data.dealId || null,
        status: data.status,
        createdBy: req.user!.userId,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        documentData: data.documentData || {}
      },
      include: {
        lead: true,
        property: true,
        project: true,
        deal: true,
        creator: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'document_created',
        entityType: 'document',
        entityId: document.id,
        details: { documentName: document.name, documentType: document.type }
      }
    });

    return res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create Document Error:', error);
    return res.status(500).json({ error: 'Failed to create document' });
  }
};

export const updateDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateDocumentSchema.parse(req.body);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
    if (data.leadId !== undefined) updateData.leadId = data.leadId;
    if (data.propertyId !== undefined) updateData.propertyId = data.propertyId;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.dealId !== undefined) updateData.dealId = data.dealId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (data.documentData !== undefined) updateData.documentData = data.documentData;
    if (data.status === 'signed') updateData.signedAt = new Date();

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        lead: true,
        property: true,
        project: true,
        deal: true,
        creator: {
          select: { id: true, fullName: true, email: true }
        },
        signatures: {
          include: {
            signer: {
              select: { id: true, fullName: true, email: true }
            }
          }
        }
      }
    });

    return res.json(document);
  } catch (error) {
    console.error('Update Document Error:', error);
    return res.status(500).json({ error: 'Failed to update document' });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete documents' });
    }

    await prisma.document.delete({ where: { id } });

    return res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete Document Error:', error);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
};

// ==================== SIGN DOCUMENT ====================

export const signDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = signDocumentSchema.parse(req.body);

    const document = await prisma.document.findUnique({ where: { id } });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.status === 'signed') {
      return res.status(400).json({ error: 'Document already signed' });
    }

    // Create signature record
    await prisma.documentSignature.create({
      data: {
        documentId: id,
        signerId: req.user!.userId,
        signatureData: data.signatureData,
        signerName: data.signerName,
        signerRole: data.signerRole,
        ipAddress: data.ipAddress
      }
    });

    // Update document status
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        status: 'signed',
        signedAt: new Date()
      },
      include: {
        lead: true,
        property: true,
        project: true,
        deal: true,
        creator: {
          select: { id: true, fullName: true, email: true }
        },
        signatures: {
          include: {
            signer: {
              select: { id: true, fullName: true, email: true }
            }
          }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        action: 'document_signed',
        entityType: 'document',
        entityId: id,
        details: {
          documentName: document.name,
          signerName: data.signerName
        }
      }
    });

    return res.json(updatedDocument);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Sign Document Error:', error);
    return res.status(500).json({ error: 'Failed to sign document' });
  }
};

// ==================== GENERATE DOCUMENT FROM TEMPLATE ====================

export const generateDocument = async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = generateDocumentSchema.parse(req.body);
    const { templateType, leadId, dealId, propertyId, data } = validatedData;

    // Fetch related data
    const lead = leadId ? await prisma.lead.findUnique({ where: { id: leadId } }) : null;
    const deal = dealId ? await prisma.deal.findUnique({ where: { id: dealId } }) : null;
    const property = propertyId ? await prisma.property.findUnique({ where: { id: propertyId } }) : null;

    // Generate PDF
    const fileUrl = await generatePDF(templateType, { lead, deal, property, ...data });

    // Create document record
    const document = await prisma.document.create({
      data: {
        name: `${templateType}_${Date.now()}.pdf`,
        type: templateType,
        fileUrl,
        leadId: leadId || null,
        dealId: dealId || null,
        propertyId: propertyId || null,
        status: 'draft',
        createdBy: req.user!.userId,
        documentData: data
      },
      include: {
        lead: true,
        property: true,
        deal: true,
        creator: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });

    return res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Generate Document Error:', error);
    return res.status(500).json({ error: 'Failed to generate document' });
  }
};

// ==================== HELPER: GENERATE PDF ====================

async function generatePDF(templateType: string, data: any): Promise<string> {
  return new Promise((resolve, reject) => {
    // Updated path to match your requirement: uplodall/document
    const uploadsDir = path.join(__dirname, '../../uplodall/document');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${templateType}_${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    const stream = fs.createWriteStream(filePath);
    const doc = new PDFDocument({ margin: 50 });

    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('Your Company Name', { align: 'center' });
    doc.fontSize(10).text('Address Line 1, Address Line 2', { align: 'center' });
    doc.text('Phone: +91-XXXXXXXXXX | Email: info@company.com', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Document Title
    const title = templateType.replace(/_/g, ' ').toUpperCase();
    doc.fontSize(16).text(title, { align: 'center', underline: true });
    doc.moveDown();

    // Date
    doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString('en-IN')}`, { align: 'right' });
    doc.moveDown();

    // Template-specific content
    switch (templateType) {
      case 'quotation':
        generateQuotation(doc, data);
        break;
      case 'proposal':
        generateProposal(doc, data);
        break;
      case 'booking_form':
        generateBookingForm(doc, data);
        break;
      case 'sale_agreement':
        generateSaleAgreement(doc, data);
        break;
      case 'receipt':
        generateReceipt(doc, data);
        break;
    }

    // Footer
    doc.fontSize(8).text(
      'This is a computer-generated document. No signature is required.',
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

    doc.end();

    stream.on('finish', () => {
      // Return relative path from backend root
      resolve(`/uplodall/document/${fileName}`);
    });

    stream.on('error', reject);
  });
}

function generateQuotation(doc: typeof PDFDocument, data: any) {
  const { lead, property, deal } = data;

  doc.fontSize(12).text('Customer Details:', { underline: true });
  doc.fontSize(10);
  if (lead) {
    doc.text(`Name: ${lead.name}`);
    doc.text(`Phone: ${lead.phone}`);
    if (lead.email) doc.text(`Email: ${lead.email}`);
  }
  doc.moveDown();

  doc.fontSize(12).text('Property Details:', { underline: true });
  doc.fontSize(10);
  if (property) {
    doc.text(`Property: ${property.title}`);
    doc.text(`Location: ${property.location}`);
    doc.text(`Type: ${property.propertyType}`);
    if (property.bedrooms) doc.text(`Bedrooms: ${property.bedrooms}`);
    if (property.areaSqft) doc.text(`Area: ${property.areaSqft} sq.ft`);
  }
  doc.moveDown();

  doc.fontSize(12).text('Pricing:', { underline: true });
  doc.fontSize(10);
  const price = property?.price || deal?.dealValue || data.amount || 0;
  const discount = data.discount || 0;
  const tax = data.tax || 0;
  const total = price - discount + tax;

  doc.text(`Base Price: ₹${price.toLocaleString('en-IN')}`);
  if (discount > 0) doc.text(`Discount: -₹${discount.toLocaleString('en-IN')}`);
  if (tax > 0) doc.text(`Tax (GST): +₹${tax.toLocaleString('en-IN')}`);
  
  // Use font method instead of bold option
  doc.font('Helvetica-Bold')
     .text(`Total Amount: ₹${total.toLocaleString('en-IN')}`);
  
  doc.font('Helvetica').moveDown();

  if (data.paymentTerms) {
    doc.fontSize(12).text('Payment Terms:', { underline: true });
    doc.fontSize(10).text(data.paymentTerms);
    doc.moveDown();
  }

  if (data.validUntil) {
    doc.font('Helvetica-Oblique')
       .fontSize(10)
       .text(`This quotation is valid until: ${data.validUntil}`);
    doc.font('Helvetica');
  }
}

function generateProposal(doc: typeof PDFDocument, data: any) {
  generateQuotation(doc, data);

  doc.moveDown();
  doc.fontSize(12).text('Proposal Summary:', { underline: true });
  doc.fontSize(10).text(data.proposalSummary || 'Premium property with excellent amenities and location.');
  doc.moveDown();

  if (data.additionalTerms) {
    doc.fontSize(12).text('Terms & Conditions:', { underline: true });
    doc.fontSize(10).text(data.additionalTerms);
  }
}

function generateBookingForm(doc: typeof PDFDocument, data: any) {
  const { lead, property } = data;

  doc.fontSize(12).text('Booking Application Form', { underline: true });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Applicant Name: ${lead?.name || '_______________________'}`);
  doc.text(`Phone: ${lead?.phone || '_______________________'}`);
  doc.text(`Email: ${lead?.email || '_______________________'}`);
  doc.moveDown();

  doc.text(`Property: ${property?.title || '_______________________'}`);
  doc.text(`Location: ${property?.location || '_______________________'}`);
  doc.text(`Booking Amount: ₹${(data.bookingAmount || 0).toLocaleString('en-IN')}`);
  doc.moveDown();

  doc.fontSize(12).text('Declaration:', { underline: true });
  doc.fontSize(9).text(
    'I hereby apply for booking the above-mentioned property and agree to abide by the terms and conditions.'
  );
  doc.moveDown(2);

  doc.text('Applicant Signature: _______________________     Date: _______________________');
}

function generateSaleAgreement(doc: typeof PDFDocument, data: any) {
  const { lead, property } = data;

  doc.fontSize(12).text('SALE AGREEMENT', { align: 'center', underline: true });
  doc.moveDown();

  doc.fontSize(10).text(
    `This Agreement is made on ${new Date().toLocaleDateString('en-IN')} between:`
  );
  doc.moveDown();

  // Use font method instead of bold option
  doc.font('Helvetica-Bold').text('SELLER: Your Company Name');
  doc.font('Helvetica').text('Address: Company Address');
  doc.moveDown();

  doc.font('Helvetica-Bold').text('BUYER:');
  doc.font('Helvetica').text(`Name: ${lead?.name || '___________________'}`);
  doc.text(`Phone: ${lead?.phone || '___________________'}`);
  doc.moveDown();

  doc.fontSize(12).text('PROPERTY DETAILS:', { underline: true });
  doc.fontSize(10);
  if (property) {
    doc.text(`Property: ${property.title}`);
    doc.text(`Location: ${property.location}`);
    doc.text(`Sale Consideration: ₹${property.price.toLocaleString('en-IN')}`);
  }
  doc.moveDown();

  doc.fontSize(12).text('TERMS & CONDITIONS:', { underline: true });
  doc.fontSize(9);
  doc.text('1. The buyer agrees to purchase the property at the agreed price.');
  doc.text('2. Payment shall be made as per the payment schedule.');
  doc.text('3. Possession will be handed over upon full payment.');
  doc.text('4. All statutory approvals are in place.');
  doc.moveDown(2);

  doc.fontSize(10);
  doc.text('SELLER Signature: _________________     BUYER Signature: _________________');
}

function generateReceipt(doc: typeof PDFDocument, data: any) {
  const { lead, payment } = data;

  doc.fontSize(14).text('PAYMENT RECEIPT', { align: 'center', underline: true });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Receipt No: ${data.receiptNumber || 'REC' + Date.now()}`);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
  doc.moveDown();

  doc.text(`Received from: ${lead?.name || data.customerName || '___________________'}`);
  doc.text(`Phone: ${lead?.phone || '___________________'}`);
  doc.moveDown();

  doc.text(`Amount Received: ₹${(payment?.amount || data.amount || 0).toLocaleString('en-IN')}`);
  doc.text(`Payment Method: ${payment?.paymentMethod || data.paymentMethod || 'Cash'}`);
  doc.text(`Towards: ${data.paymentFor || 'Property Booking'}`);
  doc.moveDown();

  if (data.propertyDetails) {
    doc.text(`Property: ${data.propertyDetails}`);
  }
  doc.moveDown(2);

  doc.text('Authorized Signatory: _______________________');
}

export const downloadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({ where: { id } });

    if (!document || !document.fileUrl) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = path.join(__dirname, '../..', document.fileUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    return res.download(filePath, document.name);
  } catch (error) {
    console.error('Download Document Error:', error);
    return res.status(500).json({ error: 'Failed to download document' });
  }
};