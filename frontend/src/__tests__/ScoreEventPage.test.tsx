import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: (globalThis as Record<string, unknown>).__mockIsAdmin ?? true,
    isAnyAdmin: (globalThis as Record<string, unknown>).__mockIsAdmin ?? true,
    loading: false,
  }),
}));

const mockGetById = vi.fn();
const mockGetAllCouples = vi.fn();
const mockGetAllJudges = vi.fn();
const mockSubmitScores = vi.fn();

vi.mock('../api/client', () => ({
  eventsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    submitScores: (...args: unknown[]) => mockSubmitScores(...args),
  },
  couplesApi: {
    getAll: (...args: unknown[]) => mockGetAllCouples(...args),
  },
  judgesApi: {
    getAll: (...args: unknown[]) => mockGetAllJudges(...args),
  },
}));

import ScoreEventPage from '../pages/events/ScoreEventPage';

function renderWithRoute(eventId = '1', round?: string) {
  const path = round ? `/events/${eventId}/score/${round}` : `/events/${eventId}/score`;
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/events/:id/score/:round?" element={<ScoreEventPage />} />
        <Route path="/events/:id/results/:round" element={<div>Results Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const mockEvent = {
  id: 1,
  name: 'Waltz Final',
  competitionId: 1,
  scoringType: 'standard',
  heats: [
    {
      round: 'final',
      bibs: [101, 102],
      judges: [10, 11],
    },
  ],
};

const mockCouples = [
  { bib: 101, leaderName: 'Alice Smith', followerName: 'Bob Jones', competitionId: 1 },
  { bib: 102, leaderName: 'Carol White', followerName: 'Dave Brown', competitionId: 1 },
];

const mockJudges = [
  { id: 10, name: 'Judge Alpha', judgeNumber: 1, competitionId: 1, isChairman: false },
  { id: 11, name: 'Judge Beta', judgeNumber: 2, competitionId: 1, isChairman: false },
];

describe('ScoreEventPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__mockIsAdmin = true;
  });

  it('should show loading state initially', () => {
    mockGetById.mockReturnValue(new Promise(() => {})); // never resolves
    mockGetAllCouples.mockReturnValue(new Promise(() => {}));
    mockGetAllJudges.mockReturnValue(new Promise(() => {}));

    renderWithRoute();

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show "Event not found" when the API returns an error', async () => {
    mockGetById.mockRejectedValue(new Error('Not found'));

    renderWithRoute();

    expect(await screen.findByText('Event not found')).toBeInTheDocument();
  });

  it('should show access denied when user is not an admin', async () => {
    (globalThis as Record<string, unknown>).__mockIsAdmin = false;

    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You must be an admin to score events.')).toBeInTheDocument();
  });

  it('should show event name and scoring form when data loads', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('Score Event: Waltz Final')).toBeInTheDocument();
  });

  it('should show couple names in the scoring table', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Carol White')).toBeInTheDocument();
    expect(screen.getByText('Dave Brown')).toBeInTheDocument();
  });

  it('should show judge names as column headers', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('#1: Judge Alpha')).toBeInTheDocument();
    expect(screen.getByText('#2: Judge Beta')).toBeInTheDocument();
  });

  it('should show "Final Round" info banner for a final round', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('Final Round')).toBeInTheDocument();
    expect(screen.getByText('Enter rankings for each couple (1 = best).')).toBeInTheDocument();
  });

  it('should show "Recall Round" info banner for a semi-final round', async () => {
    const recallEvent = {
      ...mockEvent,
      name: 'Waltz Semi',
      heats: [
        { round: 'semi-final', bibs: [101, 102], judges: [10] },
        { round: 'final', bibs: [101], judges: [10] },
      ],
    };

    mockGetById.mockResolvedValue({ data: recallEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute('1', 'semi-final');

    expect(await screen.findByText('Recall Round')).toBeInTheDocument();
    expect(screen.getByText('Check the box for couples you want to recall to the next round.')).toBeInTheDocument();
  });

  it('should show "Proficiency Scoring" info banner for proficiency events', async () => {
    const proficiencyEvent = {
      ...mockEvent,
      name: 'Proficiency Waltz',
      scoringType: 'proficiency',
    };

    mockGetById.mockResolvedValue({ data: proficiencyEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('Proficiency Scoring')).toBeInTheDocument();
    expect(screen.getByText('Enter a score from 0-100 for each couple.')).toBeInTheDocument();
  });

  it('should render number inputs for final round scoring', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    // Wait for the table to appear
    await screen.findByText('Alice Smith');

    const numberInputs = document.querySelectorAll('input[type="number"]');
    // 2 couples × 2 judges = 4 inputs
    expect(numberInputs.length).toBe(4);
  });

  it('should render checkboxes for recall round scoring', async () => {
    const recallEvent = {
      ...mockEvent,
      heats: [
        { round: 'semi-final', bibs: [101, 102], judges: [10, 11] },
        { round: 'final', bibs: [101], judges: [10, 11] },
      ],
    };

    mockGetById.mockResolvedValue({ data: recallEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute('1', 'semi-final');

    await screen.findByText('Alice Smith');

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    // 2 couples × 2 judges = 4 checkboxes
    expect(checkboxes.length).toBe(4);
  });

  it('should show round selector buttons for multi-round events', async () => {
    const multiRoundEvent = {
      ...mockEvent,
      name: 'Big Waltz',
      heats: [
        { round: 'semi-final', bibs: [101, 102], judges: [10] },
        { round: 'final', bibs: [101], judges: [10] },
      ],
    };

    mockGetById.mockResolvedValue({ data: multiRoundEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute('1', 'final');

    await screen.findByText('Score Event: Big Waltz');

    expect(screen.getByText('semi-final')).toBeInTheDocument();
    expect(screen.getByText('final')).toBeInTheDocument();
  });

  it('should NOT show round selector when event has only one round', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    await screen.findByText('Score Event: Waltz Final');

    // The round label only appears when heats.length > 1
    expect(screen.queryByText('Round:')).not.toBeInTheDocument();
  });

  it('should show "No couples in this round yet." when round has no couples', async () => {
    const eventNoCouples = {
      ...mockEvent,
      heats: [{ round: 'final', bibs: [], judges: [10] }],
    };

    mockGetById.mockResolvedValue({ data: eventNoCouples });
    mockGetAllCouples.mockResolvedValue({ data: [] });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('No couples in this round yet.')).toBeInTheDocument();
  });

  it('should show "Submit Scores" and "Cancel" buttons when couples are present', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByRole('button', { name: 'Submit Scores' })).toBeInTheDocument();
    // There are two Cancel buttons (header + form footer)
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    expect(cancelButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('should show an error message when score submission fails', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });
    mockSubmitScores.mockRejectedValue({
      response: { data: { error: 'Invalid scores provided' } },
    });

    renderWithRoute();

    const submitButton = await screen.findByRole('button', { name: 'Submit Scores' });
    fireEvent.click(submitButton);

    expect(await screen.findByText('Invalid scores provided')).toBeInTheDocument();
  });

  it('should show a fallback error message when submission fails without response data', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });
    mockSubmitScores.mockRejectedValue(new Error('Network error'));

    renderWithRoute();

    const submitButton = await screen.findByRole('button', { name: 'Submit Scores' });
    fireEvent.click(submitButton);

    expect(await screen.findByText('Failed to submit scores')).toBeInTheDocument();
  });

  it('should navigate to results page after successful score submission', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });
    mockSubmitScores.mockResolvedValue({ data: { success: true } });

    renderWithRoute();

    const submitButton = await screen.findByRole('button', { name: 'Submit Scores' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Results Page')).toBeInTheDocument();
    });
  });

  it('should show chairman star in judge column header', async () => {
    const chairmanJudges = [
      { id: 10, name: 'Judge Alpha', judgeNumber: 1, competitionId: 1, isChairman: true },
      { id: 11, name: 'Judge Beta', judgeNumber: 2, competitionId: 1, isChairman: false },
    ];

    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: chairmanJudges });

    renderWithRoute();

    // Chairman judge header includes the star character ★
    expect(await screen.findByText('#1: Judge Alpha ★')).toBeInTheDocument();
    expect(screen.getByText('#2: Judge Beta')).toBeInTheDocument();
  });

  it('should show bib numbers in the scoring table', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('#101')).toBeInTheDocument();
    expect(screen.getByText('#102')).toBeInTheDocument();
  });

  it('should show table headers: Bib #, Leader, Follower', async () => {
    mockGetById.mockResolvedValue({ data: mockEvent });
    mockGetAllCouples.mockResolvedValue({ data: mockCouples });
    mockGetAllJudges.mockResolvedValue({ data: mockJudges });

    renderWithRoute();

    expect(await screen.findByText('Bib #')).toBeInTheDocument();
    expect(screen.getByText('Leader')).toBeInTheDocument();
    expect(screen.getByText('Follower')).toBeInTheDocument();
  });
});
