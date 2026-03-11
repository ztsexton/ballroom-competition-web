import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Competition } from '../types';

// Mock auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

// Mock the competition context - use a getter to allow dynamic values
const getMockCompetition = (): Competition | null => {
  return (globalThis as any).__mockActiveCompetition || null;
};

vi.mock('../context/CompetitionContext', () => ({
  useCompetition: () => ({
    activeCompetition: getMockCompetition(),
    setActiveCompetition: vi.fn(),
  }),
}));

// Mock API client
const mockGetSummary = vi.fn();

vi.mock('../api/client', () => ({
  competitionsApi: {
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
  },
  studiosApi: {
    getById: vi.fn(() => Promise.resolve({ data: null })),
  },
  organizationsApi: {
    getById: vi.fn(() => Promise.resolve({ data: null })),
  },
}));

// Import component after all mocks are set up
import CompetitionDetailsPage from '../pages/competitions/CompetitionDetailsPage';

function renderWithRoute(competitionId = '1') {
  return render(
    <MemoryRouter
      initialEntries={[`/competitions/${competitionId}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/competitions/:id" element={<CompetitionDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseSummary = {
  counts: { people: 5, couples: 3, judges: 2, events: 4 },
  schedule: { scheduleHeats: 10, currentHeatIndex: 0, completedCount: 0, scheduleExists: true },
};

const baseCompetition: Competition = {
  id: 1,
  name: 'Spring Classic 2026',
  type: 'NDCA',
  date: '2026-06-15',
  location: 'Grand Ballroom, NYC',
  createdAt: '2026-01-01',
};

describe('CompetitionDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockActiveCompetition = null;
  });

  it('should show loading skeleton initially', () => {
    mockGetSummary.mockReturnValue(new Promise(() => {})); // never resolves
    (globalThis as any).__mockActiveCompetition = baseCompetition;

    renderWithRoute();

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show "Competition not found." when no active competition', async () => {
    (globalThis as any).__mockActiveCompetition = null;
    mockGetSummary.mockResolvedValue({ data: baseSummary });

    renderWithRoute();

    expect(await screen.findByText('Competition not found.')).toBeInTheDocument();
  });

  it('should show competition name and details when loaded', async () => {
    (globalThis as any).__mockActiveCompetition = baseCompetition;
    mockGetSummary.mockResolvedValue({ data: baseSummary });

    renderWithRoute();

    expect(await screen.findByText('Spring Classic 2026')).toBeInTheDocument();
    expect(screen.getByText('NDCA')).toBeInTheDocument();
    expect(screen.getByText('Grand Ballroom, NYC')).toBeInTheDocument();
  });

  it('should show workflow steps with correct labels', async () => {
    (globalThis as any).__mockActiveCompetition = baseCompetition;
    mockGetSummary.mockResolvedValue({ data: baseSummary });

    renderWithRoute();

    expect(await screen.findByText('Setup Progress')).toBeInTheDocument();
    expect(screen.getByText('Participants')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
  });

  it('should show day-of links (On-Deck View, Live View, Judge Scoring)', async () => {
    (globalThis as any).__mockActiveCompetition = baseCompetition;
    mockGetSummary.mockResolvedValue({ data: baseSummary });

    renderWithRoute();

    expect(await screen.findByText('Competition Day')).toBeInTheDocument();

    const onDeck = screen.getByRole('link', { name: 'On-Deck View' });
    expect(onDeck).toBeInTheDocument();
    expect(onDeck).toHaveAttribute('href', '/competitions/1/ondeck');

    const live = screen.getByRole('link', { name: 'Live View' });
    expect(live).toBeInTheDocument();
    expect(live).toHaveAttribute('href', '/competitions/1/live');

    const judge = screen.getByRole('link', { name: 'Judge Scoring' });
    expect(judge).toBeInTheDocument();
    expect(judge).toHaveAttribute('href', '/competitions/1/judge');
  });

  it('should show correct count details in workflow steps', async () => {
    (globalThis as any).__mockActiveCompetition = baseCompetition;
    mockGetSummary.mockResolvedValue({ data: baseSummary });

    renderWithRoute();

    expect(await screen.findByText('5 people, 3 couples, 2 judges')).toBeInTheDocument();
    expect(screen.getByText('4 events created')).toBeInTheDocument();
    expect(screen.getByText('10 heats generated')).toBeInTheDocument();
  });
});
