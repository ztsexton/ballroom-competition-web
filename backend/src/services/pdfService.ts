import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { PersonInvoice, Competition } from '../types';

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
