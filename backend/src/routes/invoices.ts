import { Router, Request, Response, NextFunction } from 'express';
import { dataService } from '../services/dataService';
import { calculateInvoices } from '../services/invoiceService';
import { generateInvoicePDF } from '../services/pdfService';
import { sendInvoiceEmail, isEmailConfigured } from '../services/emailService';
import logger from '../utils/logger';
import { AuthRequest, requireAnyAdmin, assertCompetitionRole } from '../middleware/auth';

const router = Router();

// All invoice routes require at least competition-admin access
router.use(requireAnyAdmin);

// Check competition access for all routes with :competitionId — only admin and billing roles
router.use('/:competitionId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const competitionId = parseInt(req.params.competitionId);
  if (isNaN(competitionId)) return next();
  if (!(await assertCompetitionRole(req, res, competitionId, ['admin', 'billing']))) return;
  next();
});

// GET /api/invoices/:competitionId — compute and return full invoice summary
router.get('/:competitionId', async (req: Request, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found' });
  }
  const summary = await calculateInvoices(competitionId);
  res.json(summary);
});

// PATCH /api/invoices/:competitionId/payments — update entry payment statuses
router.patch('/:competitionId/payments', async (req: Request, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  const { entries, paid, paidBy, notes } = req.body;

  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found' });
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required' });
  }

  const result = await dataService.updateEntryPayments(competitionId, entries, {
    paid: !!paid,
    paidBy,
    notes,
  });

  res.json(result);
});

// GET /api/invoices/:competitionId/pdf/:personId — download PDF invoice
router.get('/:competitionId/pdf/:personId', async (req: Request, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  const personId = parseInt(req.params.personId);

  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found' });
  }

  const summary = await calculateInvoices(competitionId);
  const invoice = summary.invoices.find(inv => inv.personId === personId);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found for this person' });
  }

  try {
    const pdfBuffer = await generateInvoicePDF(invoice, competition);
    const safeName = invoice.personName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, 'PDF generation error');
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// POST /api/invoices/:competitionId/email/:personId — email PDF invoice
router.post('/:competitionId/email/:personId', async (req: Request, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  const personId = parseInt(req.params.personId);

  if (!isEmailConfigured()) {
    return res.status(503).json({ error: 'Email not configured. Set the RESEND_API_KEY environment variable.' });
  }

  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found' });
  }

  const person = await dataService.getPersonById(personId);
  if (!person || person.competitionId !== competitionId) {
    return res.status(404).json({ error: 'Person not found in this competition' });
  }

  if (!person.email) {
    return res.status(400).json({ error: 'Person has no email address on file' });
  }

  const summary = await calculateInvoices(competitionId);
  const invoice = summary.invoices.find(inv => inv.personId === personId);
  if (!invoice) {
    return res.status(404).json({ error: 'No invoice for this person (no entries found)' });
  }

  try {
    const pdfBuffer = await generateInvoicePDF(invoice, competition);
    await sendInvoiceEmail(person.email, invoice.personName, competition.name, pdfBuffer);
    res.json({ success: true, sentTo: person.email });
  } catch (err) {
    logger.error({ err }, 'Email send error');
    res.status(500).json({ error: 'Failed to send email' });
  }
});

export default router;
