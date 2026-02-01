import { Router, Request, Response } from 'express';
import { dataService } from '../services/dataService';
import { calculateInvoices } from '../services/invoiceService';

const router = Router();

// GET /api/invoices/:competitionId — compute and return full invoice summary
router.get('/:competitionId', (req: Request, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  const competition = dataService.getCompetitionById(competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found' });
  }
  const summary = calculateInvoices(competitionId);
  res.json(summary);
});

// PATCH /api/invoices/:competitionId/payments — update entry payment statuses
router.patch('/:competitionId/payments', (req: Request, res: Response) => {
  const competitionId = parseInt(req.params.competitionId);
  const { entries, paid, paidBy, notes } = req.body;

  const competition = dataService.getCompetitionById(competitionId);
  if (!competition) {
    return res.status(404).json({ error: 'Competition not found' });
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required' });
  }

  const result = dataService.updateEntryPayments(competitionId, entries, {
    paid: !!paid,
    paidBy,
    notes,
  });

  res.json(result);
});

export default router;
