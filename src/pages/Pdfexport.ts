import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import autoTable from 'jspdf-autotable';

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  dark: '#1e293b',
  gray: '#64748b',
  lightGray: '#f1f5f9',
};

const formatPrice = (amount: number) => {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)} K`;
  return amount.toFixed(0);
};

export const exportToPDF = (
  leads: any[],
  deals: any[],
  callLogs: any[],
  siteVisits: any[],
  projects: any[],
  agents: any[],
  period: string,
  agentId?: string,
  agentName?: string
) => {
  const doc = new jsPDF();
  let yPos = 20;

  // Filter data by agent if specified
  const filteredLeads = agentId ? leads.filter(l => l.assignedToId === agentId) : leads;
  const filteredDeals = agentId ? deals.filter(d => d.assignedToId === agentId) : deals;
  const filteredCalls = agentId ? callLogs.filter(c => c.agentId === agentId) : callLogs;
  const filteredVisits = agentId ? siteVisits.filter(v => v.conductedBy === agentId) : siteVisits;

  const closedDeals = filteredDeals.filter(d => d.stage === 'closed');
  const totalRevenue = closedDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);
  const conversionRate = filteredLeads.length > 0 ? (closedDeals.length / filteredLeads.length) * 100 : 0;

  // ===== HEADER =====
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('SALES PERFORMANCE REPORT', 105, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 105, 22, { align: 'center' });
  doc.text(`Period: ${period.toUpperCase()} | ${agentId ? `Agent: ${agentName}` : 'All Agents'}`, 105, 28, { align: 'center' });

  yPos = 45;

  // ===== KEY METRICS CARDS =====
  const metrics = [
    { label: 'Total Leads', value: filteredLeads.length.toString(), color: COLORS.primary },
    { label: 'Closed Deals', value: closedDeals.length.toString(), color: COLORS.success },
    { label: 'Total Revenue', value: `₹${formatPrice(totalRevenue)}`, color: COLORS.purple },
    { label: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`, color: COLORS.warning },
  ];

  const cardWidth = 45;
  const cardHeight = 20;
  const gap = 3;
  const startX = 15;

  metrics.forEach((metric, idx) => {
    const x = startX + (cardWidth + gap) * idx;
    
    doc.setFillColor(metric.color);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(metric.label, x + cardWidth / 2, yPos + 6, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(metric.value, x + cardWidth / 2, yPos + 15, { align: 'center' });
  });

  yPos += 30;

  // ===== LEAD BREAKDOWN =====
  doc.setFillColor(COLORS.dark);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('LEAD DISTRIBUTION', 20, yPos + 5.5);

  yPos += 12;

  const leadStats = [
    ['Temperature', 'Hot', 'Warm', 'Cold'],
    ['Count', 
      filteredLeads.filter(l => l.temperature === 'hot').length.toString(),
      filteredLeads.filter(l => l.temperature === 'warm').length.toString(),
      filteredLeads.filter(l => l.temperature === 'cold').length.toString()
    ],
    ['Stage', 'New', 'Contacted', 'Site Visit'],
    ['Count',
      filteredLeads.filter(l => l.stage === 'new').length.toString(),
      filteredLeads.filter(l => l.stage === 'contacted').length.toString(),
      filteredLeads.filter(l => l.stage === 'site_visit').length.toString()
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: leadStats,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
    headStyles: { fillColor: COLORS.primary },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: COLORS.lightGray },
    },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ===== CALL & VISIT STATS =====
  doc.setFillColor(COLORS.dark);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('ACTIVITY SUMMARY', 20, yPos + 5.5);

  yPos += 12;

  const connectedCalls = filteredCalls.filter(c => c.callStatus?.startsWith('connected')).length;
  const completedVisits = filteredVisits.filter(v => v.status === 'completed').length;
  const avgRating = filteredVisits.filter(v => v.rating).length > 0
    ? (filteredVisits.reduce((sum, v) => sum + (v.rating || 0), 0) / filteredVisits.filter(v => v.rating).length).toFixed(1)
    : 'N/A';

  const activityStats = [
    ['Metric', 'Total Calls', 'Connected', 'Connect Rate', 'Site Visits', 'Completed', 'Avg Rating'],
    ['Value', 
      filteredCalls.length.toString(),
      connectedCalls.toString(),
      filteredCalls.length > 0 ? `${((connectedCalls / filteredCalls.length) * 100).toFixed(1)}%` : '0%',
      filteredVisits.length.toString(),
      completedVisits.toString(),
      avgRating
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [activityStats[0]],
    body: [activityStats[1]],
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
    headStyles: { fillColor: COLORS.success, textColor: 255 },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ===== NEW PAGE FOR LEADS TABLE =====
  doc.addPage();
  yPos = 20;

  doc.setFillColor(COLORS.dark);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text('LEADS DETAILS', 20, yPos + 5.5);

  yPos += 12;

  const leadsTableData = filteredLeads.slice(0, 50).map(lead => [
    lead.name,
    lead.phone,
    lead.stage.toUpperCase(),
    lead.temperature.toUpperCase(),
    lead.source,
    lead.assignedTo?.fullName || 'Unassigned',
    format(new Date(lead.createdAt), 'dd MMM yy'),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Name', 'Phone', 'Stage', 'Temp', 'Source', 'Assigned To', 'Created']],
    body: leadsTableData,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // ===== DEALS TABLE =====
  if (filteredDeals.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(COLORS.dark);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('DEALS SUMMARY', 20, yPos + 5.5);

    yPos += 12;

    const dealsTableData = filteredDeals.slice(0, 30).map(deal => {
      const lead = filteredLeads.find(l => l.id === deal.leadId);
      return [
        lead?.name || 'Unknown',
        deal.dealValue ? `₹${formatPrice(deal.dealValue)}` : 'N/A',
        deal.stage.toUpperCase(),
        format(new Date(deal.createdAt), 'dd MMM yy'),
        deal.closedAt ? format(new Date(deal.closedAt), 'dd MMM yy') : 'Open',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Lead Name', 'Deal Value', 'Stage', 'Created', 'Closed']],
      body: dealsTableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLORS.success, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      margin: { left: 15, right: 15 },
    });
  }

  // ===== FOOTER ON EVERY PAGE =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(COLORS.lightGray);
    doc.rect(0, 285, 210, 12, 'F');
    doc.setTextColor(COLORS.gray);
    doc.setFontSize(8);
    doc.text(`Sales Performance Report - Confidential`, 15, 291);
    doc.text(`Page ${i} of ${pageCount}`, 195, 291, { align: 'right' });
  }

  // ===== SAVE PDF =====
  const fileName = `Sales_Report_${agentName ? agentName.replace(/\s+/g, '_') : 'All_Agents'}_${format(new Date(), 'dd-MMM-yyyy')}.pdf`;
  doc.save(fileName);
};