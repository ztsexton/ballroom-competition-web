import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { PersonInvoice, Competition, PersonHeatListResponse, PersonHeatEntry, PersonResultsResponse } from '../types';

const MARGIN = 50;
const COL_EVENT = MARGIN;
const COL_CATEGORY = 280;
const COL_DANCES = 360;
const COL_PRICE = 420;
const COL_STATUS = 480;
const PAGE_WIDTH = 612; // letter size

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function generateInvoicePDF(
  invoice: PersonInvoice,
  competition: Competition
): Promise<Buffer> {
  const currency = competition.currency || 'USD';
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    doc.pipe(stream);

    // ─── Header ───
    doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', MARGIN, MARGIN);
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica').fillColor('#555555');
    doc.text(`Competition: ${competition.name}`);
    if (competition.date) {
      doc.text(`Date: ${formatDate(competition.date)}`);
    }
    if (competition.location) {
      doc.text(`Location: ${competition.location}`);
    }
    doc.moveDown(0.75);

    // ─── Bill To ───
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
    const statusLabel = invoice.personStatus === 'professional' ? 'Professional' : 'Student';
    doc.text(`Bill To: ${invoice.personName} (${statusLabel})`);
    doc.moveDown(0.5);

    // ─── Separator ───
    const lineY = doc.y;
    doc.moveTo(MARGIN, lineY).lineTo(PAGE_WIDTH - MARGIN, lineY).strokeColor('#cccccc').lineWidth(1).stroke();
    doc.moveDown(0.75);

    // ─── Partnership sections ───
    for (const partnership of invoice.partnerships) {
      // Check if we need a new page (rough estimate: header + at least a few rows)
      if (doc.y > 650) {
        doc.addPage();
      }

      // Partnership header
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333');
      doc.text(
        `w/ ${partnership.partnerName} (Bib #${partnership.bib}) \u2014 ${partnership.lineItems.length} entries`,
        MARGIN
      );
      doc.moveDown(0.3);

      // Table header
      const headerY = doc.y;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#888888');
      doc.text('Event', COL_EVENT, headerY);
      doc.text('Category', COL_CATEGORY, headerY);
      doc.text('Dances', COL_DANCES, headerY);
      doc.text('Price', COL_PRICE, headerY);
      doc.text('Status', COL_STATUS, headerY);
      doc.moveDown(0.2);

      // Thin line under header
      const hLineY = doc.y;
      doc.moveTo(MARGIN, hLineY).lineTo(PAGE_WIDTH - MARGIN, hLineY).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
      doc.y = hLineY + 4;

      // Table rows
      const categoryLabels: Record<string, string> = { single: 'Single', multi: 'Multi', scholarship: 'Scholarship' };

      for (const item of partnership.lineItems) {
        if (doc.y > 720) {
          doc.addPage();
        }

        const rowY = doc.y;
        const textColor = item.paid ? '#aaaaaa' : '#000000';
        doc.fontSize(9).font('Helvetica').fillColor(textColor);
        doc.text(item.eventName, COL_EVENT, rowY, { width: COL_CATEGORY - COL_EVENT - 10 });
        doc.text(categoryLabels[item.category] || item.category, COL_CATEGORY, rowY);
        doc.text(String(item.danceCount), COL_DANCES, rowY);
        doc.text(fmt(item.pricePerEntry, currency), COL_PRICE, rowY);
        doc.fillColor(item.paid ? '#48bb78' : '#d69e2e');
        doc.text(item.paid ? 'Paid' : 'Unpaid', COL_STATUS, rowY);
        doc.fillColor('#000000');
        doc.y = rowY + 14;
      }

      doc.moveDown(0.3);

      // Subtotal row
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
      const subY = doc.y;
      doc.text('Subtotal:', COL_DANCES, subY);
      doc.text(fmt(partnership.subtotal, currency), COL_PRICE, subY);
      doc.y = subY + 13;

      if (partnership.paidAmount > 0) {
        const paidY = doc.y;
        doc.fontSize(9).font('Helvetica').fillColor('#48bb78');
        doc.text('Paid:', COL_DANCES, paidY);
        doc.text(fmt(partnership.paidAmount, currency), COL_PRICE, paidY);
        doc.fillColor('#000000');
        doc.y = paidY + 13;
      }

      doc.moveDown(0.75);
    }

    // ─── Grand Total ───
    if (doc.y > 680) {
      doc.addPage();
    }

    const sepY = doc.y;
    doc.moveTo(MARGIN, sepY).lineTo(PAGE_WIDTH - MARGIN, sepY).strokeColor('#333333').lineWidth(1.5).stroke();
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
    const totalY = doc.y;
    doc.text('Total:', MARGIN, totalY);
    doc.text(fmt(invoice.totalAmount, currency), COL_PRICE, totalY);
    doc.y = totalY + 18;

    const paidTotalY = doc.y;
    doc.fontSize(11).font('Helvetica').fillColor('#48bb78');
    doc.text('Paid:', MARGIN, paidTotalY);
    doc.text(fmt(invoice.paidAmount, currency), COL_PRICE, paidTotalY);
    doc.y = paidTotalY + 16;

    const outY = doc.y;
    doc.fontSize(12).font('Helvetica-Bold').fillColor(invoice.outstandingAmount > 0 ? '#d69e2e' : '#48bb78');
    doc.text('Outstanding:', MARGIN, outY);
    doc.text(fmt(invoice.outstandingAmount, currency), COL_PRICE, outY);

    doc.end();
  });
}

// ─── Heat Sheet PDF ───

const HS_COL_TIME = MARGIN;
const HS_COL_HEAT = MARGIN + 80;
const HS_COL_EVENT = MARGIN + 120;

function formatTimeFromISO(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function renderHeatSheetHeader(
  doc: InstanceType<typeof PDFDocument>,
  competition: Competition,
  firstName: string,
  lastName: string,
): void {
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000')
    .text('HEAT SHEET', MARGIN, MARGIN);
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica').fillColor('#555555');
  doc.text(competition.name);
  if (competition.date) doc.text(`Date: ${formatDate(competition.date)}`);
  if (competition.location) doc.text(`Location: ${competition.location}`);
  doc.moveDown(0.5);

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
  doc.text(`${firstName} ${lastName}`);
  doc.moveDown(0.3);

  const lineY = doc.y;
  doc.moveTo(MARGIN, lineY).lineTo(PAGE_WIDTH - MARGIN, lineY)
    .strokeColor('#cccccc').lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function renderHeatSheetBody(
  doc: InstanceType<typeof PDFDocument>,
  data: PersonHeatListResponse,
): void {
  if (data.partnerships.length === 0) {
    doc.fontSize(10).font('Helvetica').fillColor('#888888')
      .text('No heats found for this person.');
    return;
  }

  for (const partnership of data.partnerships) {
    if (doc.y > 650) doc.addPage();

    // Group heats by style
    const styleGroups: { style: string; heats: PersonHeatEntry[] }[] = [];
    for (const heat of partnership.heats) {
      const style = heat.style || 'Other';
      const group = styleGroups.find(g => g.style === style);
      if (group) group.heats.push(heat);
      else styleGroups.push({ style, heats: [heat] });
    }

    // Partnership header
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333');
    doc.text(`With ${partnership.partnerName}  (Bib #${partnership.bib})`, MARGIN);
    doc.moveDown(0.3);

    for (const group of styleGroups) {
      if (doc.y > 680) doc.addPage();

      // Style header
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#666666');
      doc.text(group.style, MARGIN);
      doc.moveDown(0.15);

      // Table header
      const headerY = doc.y;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
      doc.rect(MARGIN, headerY - 2, PAGE_WIDTH - 2 * MARGIN, 14).fill('#666666');
      doc.text('Time', HS_COL_TIME, headerY, { width: 70 });
      doc.text('Heat', HS_COL_HEAT, headerY, { width: 35 });
      doc.text('Event', HS_COL_EVENT, headerY, { width: PAGE_WIDTH - 2 * MARGIN - 120 });
      doc.y = headerY + 15;

      // Table rows
      for (let i = 0; i < group.heats.length; i++) {
        if (doc.y > 720) doc.addPage();

        const heat = group.heats[i];
        const rowY = doc.y;

        if (i % 2 === 0) {
          doc.rect(MARGIN, rowY - 1, PAGE_WIDTH - 2 * MARGIN, 13).fill('#f5f5f5');
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text(formatTimeFromISO(heat.estimatedTime), HS_COL_TIME, rowY, { width: 70 });
        doc.text(String(heat.heatNumber), HS_COL_HEAT, rowY, { width: 35 });

        let eventText = heat.eventName;
        if (heat.dance) eventText += ` (${heat.dance})`;
        if (heat.round !== 'final') eventText += ` [${heat.round.replace('-', ' ')}]`;
        doc.text(eventText, HS_COL_EVENT, rowY, { width: PAGE_WIDTH - 2 * MARGIN - 120 });

        doc.y = rowY + 13;
      }

      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
  }
}

export function generateHeatSheetPDF(
  data: PersonHeatListResponse,
  competition: Competition,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    doc.pipe(stream);
    renderHeatSheetHeader(doc, competition, data.firstName, data.lastName);
    renderHeatSheetBody(doc, data);
    doc.end();
  });
}

export function generateCombinedHeatSheetPDF(
  allData: PersonHeatListResponse[],
  competition: Competition,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    doc.pipe(stream);

    for (let i = 0; i < allData.length; i++) {
      if (i > 0) doc.addPage();
      renderHeatSheetHeader(doc, competition, allData[i].firstName, allData[i].lastName);
      renderHeatSheetBody(doc, allData[i]);
    }

    doc.end();
  });
}

// ─── Results PDF ───

function renderResultsHeader(
  doc: InstanceType<typeof PDFDocument>,
  competition: Competition,
  firstName: string,
  lastName: string,
): void {
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000')
    .text('RESULTS', MARGIN, MARGIN);
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica').fillColor('#555555');
  doc.text(competition.name);
  if (competition.date) doc.text(`Date: ${formatDate(competition.date)}`);
  if (competition.location) doc.text(`Location: ${competition.location}`);
  doc.moveDown(0.5);

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
  doc.text(`${firstName} ${lastName}`);
  doc.moveDown(0.3);

  const lineY = doc.y;
  doc.moveTo(MARGIN, lineY).lineTo(PAGE_WIDTH - MARGIN, lineY)
    .strokeColor('#cccccc').lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function renderResultsBody(
  doc: InstanceType<typeof PDFDocument>,
  data: PersonResultsResponse,
): void {
  if (data.events.length === 0) {
    doc.fontSize(10).font('Helvetica').fillColor('#888888')
      .text('No results found for this person.');
    return;
  }

  for (const event of data.events) {
    if (doc.y > 650) doc.addPage();

    // Event header
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
    doc.text(event.eventName, MARGIN);

    doc.fontSize(9).font('Helvetica').fillColor('#555555');
    const meta: string[] = [];
    if (event.style) meta.push(event.style);
    if (event.level) meta.push(event.level);
    if (event.dances && event.dances.length > 0) meta.push(event.dances.join(', '));
    if (meta.length > 0) doc.text(meta.join(' \u2022 '), MARGIN);
    doc.text(`Partner: ${event.partnerName}  (Bib #${event.bib})`, MARGIN);
    doc.moveDown(0.3);

    // Show each round result
    for (const round of event.rounds) {
      if (doc.y > 700) doc.addPage();

      const roundLabel = round.round.charAt(0).toUpperCase() + round.round.slice(1).replace('-', ' ');
      const result = round.personResult;

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');

      if (round.round === 'final') {
        const placeText = result.place ? `${ordinal(result.place)} Place` : 'Unranked';
        doc.text(`${roundLabel}: ${placeText}`, MARGIN + 10);

        // Show dance-by-dance scores if available
        if (result.danceDetails && result.danceDetails.length > 1) {
          doc.fontSize(8).font('Helvetica').fillColor('#555555');
          for (const dd of result.danceDetails) {
            const placement = dd.placement ? ordinal(dd.placement) : '-';
            const scores = dd.scores.length > 0 ? dd.scores.join(', ') : '';
            doc.text(`  ${dd.dance}: ${placement}${scores ? '  (' + scores + ')' : ''}`, MARGIN + 20);
          }
        } else if (result.scores.length > 0) {
          doc.fontSize(8).font('Helvetica').fillColor('#555555');
          doc.text(`  Scores: ${result.scores.join(', ')}`, MARGIN + 20);
        }
      } else {
        const recallText = result.recalled === true ? 'Recalled' : result.recalled === false ? 'Not Recalled' : '';
        const marksText = result.totalMarks !== undefined ? `(${result.totalMarks} marks)` : '';
        doc.text(`${roundLabel}: ${recallText} ${marksText}`.trim(), MARGIN + 10);
      }
    }

    doc.moveDown(0.6);

    // Thin separator between events
    const sepY = doc.y;
    doc.moveTo(MARGIN, sepY).lineTo(PAGE_WIDTH - MARGIN, sepY)
      .strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    doc.moveDown(0.4);
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function generateResultsPDF(
  data: PersonResultsResponse,
  competition: Competition,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    doc.pipe(stream);
    renderResultsHeader(doc, competition, data.firstName, data.lastName);
    renderResultsBody(doc, data);
    doc.end();
  });
}

export function generateCombinedResultsPDF(
  allData: PersonResultsResponse[],
  competition: Competition,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    doc.pipe(stream);

    for (let i = 0; i < allData.length; i++) {
      if (i > 0) doc.addPage();
      renderResultsHeader(doc, competition, allData[i].firstName, allData[i].lastName);
      renderResultsBody(doc, allData[i]);
    }

    doc.end();
  });
}
