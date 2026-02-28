import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockGetSummary = vi.fn();
const mockUpdatePayment = vi.fn();
const mockDownloadPDF = vi.fn();
const mockEmailInvoice = vi.fn();
const mockUpdateCompetition = vi.fn();

vi.mock('../api/client', () => ({
  invoicesApi: {
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
    updatePayment: (...args: unknown[]) => mockUpdatePayment(...args),
    downloadPDF: (...args: unknown[]) => mockDownloadPDF(...args),
    emailInvoice: (...args: unknown[]) => mockEmailInvoice(...args),
  },
  competitionsApi: {
    update: (...args: unknown[]) => mockUpdateCompetition(...args),
  },
}));

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      isAxiosError: vi.fn(() => false),
    },
    isAxiosError: vi.fn(() => false),
  };
});

const getMockCompetition = () => (globalThis as any).__mockActiveCompetition || null;

vi.mock('../context/CompetitionContext', () => ({
  useCompetition: () => ({
    activeCompetition: getMockCompetition(),
    setActiveCompetition: vi.fn(),
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

import InvoicesPage from '../pages/participants/InvoicesPage';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

const makeCompetition = (overrides = {}) => ({
  id: 1,
  name: 'Test Competition',
  type: 'UNAFFILIATED' as const,
  date: '2026-06-01',
  createdAt: '2026-01-01',
  ...overrides,
});

const makeCompetitionWithPricing = (overrides = {}) =>
  makeCompetition({
    pricing: {
      singleDance: [{ minEntries: 1, pricePerEntry: 25 }],
      multiDance: { mode: 'flat', flatTiers: [{ minEntries: 1, pricePerEntry: 40 }] },
      scholarship: [{ minEntries: 1, pricePerEntry: 50 }],
    },
    currency: 'USD',
    ...overrides,
  });

const makeSummary = (invoiceOverrides = {}) => ({
  totalRevenue: 100,
  totalPaid: 50,
  totalOutstanding: 50,
  invoices: [
    {
      personId: 10,
      personName: 'Alice Smith',
      personStatus: 'student' as const,
      partnerships: [
        {
          bib: 101,
          partnerId: 20,
          partnerName: 'Bob Jones',
          lineItems: [
            {
              eventId: 1,
              eventName: 'Waltz Open',
              category: 'single' as const,
              danceCount: 1,
              pricePerEntry: 25,
              bib: 101,
              partnerName: 'Bob Jones',
              paid: false,
            },
          ],
          subtotal: 25,
          paidAmount: 0,
        },
      ],
      totalAmount: 100,
      paidAmount: 50,
      outstandingAmount: 50,
      ...invoiceOverrides,
    },
  ],
});

describe('InvoicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockActiveCompetition = null;
  });

  it('should show skeleton loading state when no competition is active', () => {
    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    // With no competition, competitionId is 0, useEffect bails early, loading stays true
    // The Skeleton component is rendered — check that no invoice-specific content is shown
    expect(screen.queryByText('Pricing Configuration')).not.toBeInTheDocument();
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
  });

  it('should show pricing configuration panel and invoices section after load', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Pricing Configuration')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('should show "Configured" badge when competition has pricing', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Configured')).toBeInTheDocument();
  });

  it('should not show "Configured" badge when competition has no pricing', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetition();
    mockGetSummary.mockResolvedValue({ data: { totalRevenue: 0, totalPaid: 0, totalOutstanding: 0, invoices: [] } });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Pricing Configuration');
    expect(screen.queryByText('Configured')).not.toBeInTheDocument();
  });

  it('should show "No pricing configured" when competition has no pricing', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetition();
    mockGetSummary.mockResolvedValue({ data: { totalRevenue: 0, totalPaid: 0, totalOutstanding: 0, invoices: [] } });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No pricing configured')).toBeInTheDocument();
    expect(screen.getByText(/Open the Pricing Configuration section above/i)).toBeInTheDocument();
  });

  it('should show empty state when pricing exists but no invoices', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: { totalRevenue: 0, totalPaid: 0, totalOutstanding: 0, invoices: [] } });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/No entries found/i)).toBeInTheDocument();
    expect(screen.getByText(/Add participants to events to generate invoices/i)).toBeInTheDocument();
  });

  it('should show empty state when getSummary throws', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockRejectedValue(new Error('Network error'));

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    // After the rejected promise, loading becomes false and summary is null
    // With pricing but no summary, it shows the empty state
    expect(await screen.findByText(/No entries found/i)).toBeInTheDocument();
  });

  it('should render summary stats when invoices exist', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Outstanding').length).toBeGreaterThanOrEqual(1);
  });

  it('should render invoice table with person name when invoices exist', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
  });

  it('should render invoice table headers', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Alice Smith');
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Entries')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should render student/professional status label for invoice rows', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Alice Smith');
    // Alice has status 'student', so should show 'Student'
    expect(screen.getByText('Student')).toBeInTheDocument();
  });

  it('should show "Pro" label for a professional person', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    const proSummary = makeSummary({ personStatus: 'professional' });
    mockGetSummary.mockResolvedValue({ data: proSummary });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Alice Smith');
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('should render "Pay All" button for unpaid invoice', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Alice Smith');
    expect(screen.getByRole('button', { name: /Pay All/i })).toBeInTheDocument();
  });

  it('should render "Paid" status and "Undo" button for fully paid invoice', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    const paidSummary = makeSummary({
      outstandingAmount: 0,
      paidAmount: 100,
      totalAmount: 100,
      partnerships: [
        {
          bib: 101,
          partnerId: 20,
          partnerName: 'Bob Jones',
          lineItems: [
            {
              eventId: 1,
              eventName: 'Waltz Open',
              category: 'single' as const,
              danceCount: 1,
              pricePerEntry: 25,
              bib: 101,
              partnerName: 'Bob Jones',
              paid: true,
            },
          ],
          subtotal: 100,
          paidAmount: 100,
        },
      ],
    });
    mockGetSummary.mockResolvedValue({ data: paidSummary });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Alice Smith');
    // The row action column should show "Paid" text and an "Undo" button
    expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Undo/i })).toBeInTheDocument();
  });

  it('should render PDF and Email action buttons per invoice row', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Alice Smith');
    expect(screen.getByRole('button', { name: /PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Email/i })).toBeInTheDocument();
  });

  it('should expand invoice row to show partnership details on click', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    // Wait for page to render
    const personRow = await screen.findByText('Alice Smith');

    // Before expansion, partnership details should not be visible
    expect(screen.queryByText('Waltz Open')).not.toBeInTheDocument();

    // Click the row to expand
    fireEvent.click(personRow.closest('tr')!);

    // After expansion, partnership details and event name appear
    expect(await screen.findByText('Waltz Open')).toBeInTheDocument();
    expect(screen.getByText(/w\/ Bob Jones/)).toBeInTheDocument();
  });

  it('should show partnership line item details when expanded', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    const personRow = await screen.findByText('Alice Smith');
    fireEvent.click(personRow.closest('tr')!);

    // Partnership section table headers
    expect(await screen.findByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Dances')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('should show footer totals row with correct people count', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/Total \(1 people\)/i)).toBeInTheDocument();
  });

  it('should expand pricing configuration section on click', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Pricing Configuration');

    // Pricing details are hidden by default (pricingOpen = false)
    expect(screen.queryByText('Single Dance')).not.toBeInTheDocument();

    // Click the header to expand
    fireEvent.click(screen.getByText('Pricing Configuration').closest('div')!);

    expect(await screen.findByText('Single Dance')).toBeInTheDocument();
    expect(screen.getByText('Multi-Dance')).toBeInTheDocument();
    expect(screen.getByText('Scholarship')).toBeInTheDocument();
  });

  it('should show "Save Pricing" button when pricing panel is open', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Pricing Configuration');
    fireEvent.click(screen.getByText('Pricing Configuration').closest('div')!);

    expect(await screen.findByRole('button', { name: /Save Pricing/i })).toBeInTheDocument();
  });

  it('should show "Flat Rate" and "By Dance Count" mode buttons when pricing panel is open', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Pricing Configuration');
    fireEvent.click(screen.getByText('Pricing Configuration').closest('div')!);

    expect(await screen.findByRole('button', { name: /Flat Rate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /By Dance Count/i })).toBeInTheDocument();
  });

  it('should call invoicesApi.getSummary with the competition id on mount', async () => {
    (globalThis as any).__mockActiveCompetition = makeCompetitionWithPricing();
    mockGetSummary.mockResolvedValue({ data: makeSummary() });

    render(
      <RouterWrapper>
        <InvoicesPage />
      </RouterWrapper>
    );

    await screen.findByText('Alice Smith');
    expect(mockGetSummary).toHaveBeenCalledWith(1);
  });
});
