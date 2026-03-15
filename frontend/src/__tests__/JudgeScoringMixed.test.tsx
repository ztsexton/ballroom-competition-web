import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetJudges = vi.fn();
const mockGetActiveHeat = vi.fn();
const mockSubmitJudgeScores = vi.fn();

vi.mock('../api/client', () => ({
  judgingApi: {
    getJudges: (...args: unknown[]) => mockGetJudges(...args),
    getActiveHeat: (...args: unknown[]) => mockGetActiveHeat(...args),
    submitJudgeScores: (...args: unknown[]) => mockSubmitJudgeScores(...args),
  },
}));

vi.mock('../hooks/useCompetitionSSE', () => ({
  useCompetitionSSE: () => {},
}));

import JudgeScoringPage from '../pages/dayof/JudgeScoring/JudgeScoringPage';

const mockJudges = [
  { id: 1, name: 'Judge One', judgeNumber: 1, competitionId: 1 },
];

function makeMixedHeatInfo() {
  return {
    competitionId: 1,
    heatId: 'heat-mixed',
    status: 'scoring',
    heatNumber: 1,
    totalHeats: 5,
    judges: [{ id: 1, name: 'Judge One', judgeNumber: 1 }],
    entries: [
      {
        eventId: 1,
        eventName: 'Waltz Standard',
        round: 'final',
        couples: [
          { bib: 101, leaderName: 'Alice', followerName: 'Bob' },
          { bib: 102, leaderName: 'Carol', followerName: 'Dave' },
        ],
        isRecallRound: false,
        scoringType: 'standard' as const,
      },
      {
        eventId: 2,
        eventName: 'Waltz Proficiency',
        round: 'final',
        couples: [
          { bib: 201, leaderName: 'Eve', followerName: 'Frank' },
          { bib: 202, leaderName: 'Grace', followerName: 'Hank' },
        ],
        isRecallRound: false,
        scoringType: 'proficiency' as const,
      },
    ],
  };
}

function makeSingleTypeHeatInfo() {
  return {
    competitionId: 1,
    heatId: 'heat-single',
    status: 'scoring',
    heatNumber: 1,
    totalHeats: 5,
    judges: [{ id: 1, name: 'Judge One', judgeNumber: 1 }],
    entries: [
      {
        eventId: 1,
        eventName: 'Waltz Standard',
        round: 'final',
        couples: [
          { bib: 101, leaderName: 'Alice', followerName: 'Bob' },
          { bib: 102, leaderName: 'Carol', followerName: 'Dave' },
        ],
        isRecallRound: false,
        scoringType: 'standard' as const,
      },
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/competitions/1/judge']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/competitions/:id/judge" element={<JudgeScoringPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function selectJudge() {
  // Wait for judge selection card to appear
  await screen.findByText('Select your judge identity to begin.');
  // Click the first button in the selection list
  const buttons = screen.getAllByRole('button');
  fireEvent.click(buttons[0]);
}

describe('JudgeScoringPage — mixed scoring types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJudges.mockResolvedValue({ data: mockJudges });
  });

  it('should show both InputMethodToggles for mixed scoring types', async () => {
    mockGetActiveHeat.mockResolvedValue({ data: makeMixedHeatInfo() });

    renderPage();
    await selectJudge();

    // Wait for scoring form to appear
    await screen.findByText('Waltz Standard');

    // Should show per-type labels
    expect(screen.getByText('Ranking events:')).toBeInTheDocument();
    expect(screen.getByText('Proficiency events:')).toBeInTheDocument();
  });

  it('should show scoring type badges on entry headers for mixed types', async () => {
    mockGetActiveHeat.mockResolvedValue({ data: makeMixedHeatInfo() });

    renderPage();
    await selectJudge();

    await screen.findByText('Waltz Standard');

    // Should show badge for each scoring type (compact labels)
    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('Prof')).toBeInTheDocument();
  });

  it('should show single InputMethodToggle for single scoring type', async () => {
    mockGetActiveHeat.mockResolvedValue({ data: makeSingleTypeHeatInfo() });

    renderPage();
    await selectJudge();

    // Wait for scoring form to appear (single entry doesn't show event name header)
    await screen.findByText('Tap');

    // Should NOT show per-type labels
    expect(screen.queryByText('Ranking events:')).not.toBeInTheDocument();
    expect(screen.queryByText('Proficiency events:')).not.toBeInTheDocument();

    // Should have the standard ranking toggle buttons (Tap, Picker, Keyboard)
    expect(screen.getByText('Picker')).toBeInTheDocument();
    expect(screen.getByText('Keyboard')).toBeInTheDocument();
  });
});
