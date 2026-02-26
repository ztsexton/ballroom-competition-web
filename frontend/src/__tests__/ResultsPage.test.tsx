import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

// Mock result sub-components to avoid deep rendering
vi.mock('../components/results/JudgeGrid', () => ({
  JudgeGrid: ({ isRecall }: { isRecall: boolean }) => (
    <div data-testid="judge-grid">{isRecall ? 'Recall Grid' : 'Placement Grid'}</div>
  ),
}));

vi.mock('../components/results/SkatingBreakdown', () => ({
  SkatingBreakdown: () => <div data-testid="skating-breakdown">Skating Breakdown</div>,
}));

vi.mock('../components/results/MultiDanceSummary', () => ({
  MultiDanceSummary: () => <div data-testid="multi-dance-summary">Multi Dance Summary</div>,
}));

// Default mock implementations
const mockGetById = vi.fn();
const mockGetDetailedResults = vi.fn();

vi.mock('../api/client', () => ({
  eventsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getDetailedResults: (...args: unknown[]) => mockGetDetailedResults(...args),
  },
}));

import ResultsPage from '../pages/events/ResultsPage';

function renderWithRoute(eventId = '1', round?: string) {
  const path = round ? `/events/${eventId}/results/${round}` : `/events/${eventId}/results`;
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/events/:id/results/:round?" element={<ResultsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGetById.mockReturnValue(new Promise(() => {})); // never resolves
    mockGetDetailedResults.mockReturnValue(new Promise(() => {}));

    renderWithRoute();

    // Loading state now renders a skeleton instead of text
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show "Event not found" when event API returns error', async () => {
    mockGetById.mockRejectedValue(new Error('Not found'));
    mockGetDetailedResults.mockRejectedValue(new Error('Not found'));

    renderWithRoute();

    expect(await screen.findByText('Event not found')).toBeInTheDocument();
  });

  it('should show "No scores submitted yet" when no results exist', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Waltz',
        heats: [{ round: 'final', bibs: [1], judges: [] }],
      },
    });
    mockGetDetailedResults.mockResolvedValue({
      data: {
        judges: [],
        results: [],
        dances: [],
      },
    });

    renderWithRoute();

    expect(await screen.findByText(/No scores submitted yet/)).toBeInTheDocument();
  });

  it('should show recall marks grid for recall round', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Big Event',
        heats: [
          { round: 'semi-final', bibs: [1, 2], judges: [1] },
          { round: 'final', bibs: [1], judges: [1] },
        ],
      },
    });
    mockGetDetailedResults.mockResolvedValue({
      data: {
        judges: [{ id: 1, judgeNumber: 1, name: 'Judge A' }],
        results: [
          { bib: 1, leaderName: 'L', followerName: 'F', scores: [1], totalMarks: 1, isRecall: true },
        ],
        dances: [],
      },
    });

    renderWithRoute('1', 'semi-final');

    expect(await screen.findByText('Recall Marks')).toBeInTheDocument();
    expect(screen.getByTestId('judge-grid')).toBeInTheDocument();
  });

  it('should show placement grid and skating breakdown for final round', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Waltz Final',
        heats: [{ round: 'final', bibs: [1, 2], judges: [1] }],
      },
    });
    mockGetDetailedResults.mockResolvedValue({
      data: {
        judges: [{ id: 1, judgeNumber: 1, name: 'Judge A' }],
        results: [
          {
            bib: 1, leaderName: 'L1', followerName: 'F1', scores: [1], place: 1,
            totalRank: 1, isRecall: false,
            skatingDetail: { cumulativeCounts: [1], cumulativeSums: [1] },
          },
          {
            bib: 2, leaderName: 'L2', followerName: 'F2', scores: [2], place: 2,
            totalRank: 2, isRecall: false,
            skatingDetail: { cumulativeCounts: [0], cumulativeSums: [0] },
          },
        ],
        dances: [],
      },
    });

    renderWithRoute();

    expect(await screen.findByText('Judge Placements')).toBeInTheDocument();
    expect(screen.getByTestId('skating-breakdown')).toBeInTheDocument();
  });

  it('should show multi-dance summary for multi-dance finals', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Multi Dance Event',
        heats: [{ round: 'final', bibs: [1], judges: [1] }],
      },
    });
    mockGetDetailedResults.mockResolvedValue({
      data: {
        judges: [{ id: 1, judgeNumber: 1, name: 'Judge A' }],
        results: [
          {
            bib: 1, leaderName: 'L', followerName: 'F', scores: [1], place: 1,
            totalRank: 1, isRecall: false,
            danceDetails: [
              { dance: 'waltz', placement: 1, skatingDetail: { cumulativeCounts: [1], cumulativeSums: [1] } },
              { dance: 'tango', placement: 1, skatingDetail: { cumulativeCounts: [1], cumulativeSums: [1] } },
            ],
          },
        ],
        dances: ['waltz', 'tango'],
      },
    });

    renderWithRoute();

    expect(await screen.findByText('Overall Placement')).toBeInTheDocument();
    expect(screen.getByTestId('multi-dance-summary')).toBeInTheDocument();
  });

  it('should show proficiency scores table', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Proficiency Event',
        scoringType: 'proficiency',
        heats: [{ round: 'final', bibs: [1], judges: [1] }],
      },
    });
    mockGetDetailedResults.mockResolvedValue({
      data: {
        judges: [{ id: 1, judgeNumber: 1, name: 'Judge A' }],
        results: [
          {
            bib: 1, leaderName: 'L', followerName: 'F', scores: [8],
            totalScore: 8.0, isRecall: false,
          },
        ],
        dances: [],
      },
    });

    renderWithRoute();

    expect(await screen.findByText('Proficiency Scores')).toBeInTheDocument();
    expect(screen.getByText('8.0')).toBeInTheDocument();
  });

  it('should show round selector for multi-round events', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Big Event',
        heats: [
          { round: 'semi-final', bibs: [1, 2, 3], judges: [1] },
          { round: 'final', bibs: [1, 2], judges: [1] },
        ],
      },
    });
    mockGetDetailedResults.mockResolvedValue({
      data: {
        judges: [],
        results: [],
        dances: [],
      },
    });

    renderWithRoute();

    // Wait for content to load
    await screen.findByText(/Results: Big Event/);

    // Both round buttons should be visible
    expect(screen.getByText('semi-final')).toBeInTheDocument();
    expect(screen.getByText('final')).toBeInTheDocument();
  });
});
