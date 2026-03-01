import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JudgeScheduleEntry } from '../types';

const mockEntries: JudgeScheduleEntry[] = [
  {
    judgeId: 1,
    judgeName: 'Alice Smith',
    judgeNumber: 1,
    isChairman: false,
    heats: [
      { heatIndex: 0, heatId: 'h1', eventNames: ['Bronze Waltz'], round: 'final', estimatedStartTime: '2026-06-15T09:00:00Z', estimatedDurationSeconds: 120 },
      { heatIndex: 1, heatId: 'h2', eventNames: ['Silver Tango'], round: 'semi-final', estimatedStartTime: '2026-06-15T09:05:00Z', estimatedDurationSeconds: 120 },
    ],
    totalHeatCount: 2,
    estimatedWorkingMinutes: 30,
    segments: [
      { startHeatIndex: 0, endHeatIndex: 1, durationMinutes: 30, exceedsLimit: false },
    ],
  },
  {
    judgeId: 2,
    judgeName: 'Bob Jones',
    judgeNumber: 2,
    isChairman: true,
    heats: [
      { heatIndex: 0, heatId: 'h1', eventNames: ['Bronze Waltz'], round: 'final', estimatedStartTime: '2026-06-15T09:00:00Z', estimatedDurationSeconds: 120 },
      { heatIndex: 1, heatId: 'h2', eventNames: ['Silver Tango'], round: 'semi-final', estimatedStartTime: '2026-06-15T09:05:00Z', estimatedDurationSeconds: 120 },
      { heatIndex: 4, heatId: 'h5', eventNames: ['Gold Foxtrot'], round: 'final', estimatedStartTime: '2026-06-15T15:00:00Z', estimatedDurationSeconds: 120 },
    ],
    totalHeatCount: 3,
    estimatedWorkingMinutes: 400,
    segments: [
      { startHeatIndex: 0, endHeatIndex: 1, durationMinutes: 30, exceedsLimit: false },
      { startHeatIndex: 4, endHeatIndex: 4, durationMinutes: 370, exceedsLimit: true },
    ],
  },
];

const defaultMockData = {
  entries: mockEntries,
  maxMinutesWithoutBreak: 360,
};

const getScheduleData = () =>
  (globalThis as Record<string, unknown>).__mockScheduleData ?? defaultMockData;

vi.mock('../api/client', () => ({
  schedulesApi: {
    getJudgeSchedule: vi.fn(() => Promise.resolve({ data: getScheduleData() })),
  },
}));

import JudgeScheduleView from '../pages/dayof/Schedule/components/JudgeScheduleView';

describe('JudgeScheduleView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__mockScheduleData = defaultMockData;
  });

  it('should show empty state when no judges are assigned', async () => {
    (globalThis as Record<string, unknown>).__mockScheduleData = {
      entries: [],
      maxMinutesWithoutBreak: 360,
    };

    render(<JudgeScheduleView competitionId={1} />);
    expect(await screen.findByText(/No judges assigned/)).toBeInTheDocument();
  });

  it('should show summary line with judge count and max hours', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    expect(await screen.findByText('2 judges')).toBeInTheDocument();
    expect(screen.getByText('6h')).toBeInTheDocument();
  });

  it('should show warning count when judges exceed limit', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    expect(await screen.findByText('1 judge exceeds limit')).toBeInTheDocument();
  });

  it('should render the day timeline when timing data is available', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    // Legend items from the DayTimeline
    expect(await screen.findByText('Judging')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('should show fallback message when no timing data', async () => {
    const noTimeEntries = mockEntries.map(e => ({
      ...e,
      heats: e.heats.map(h => ({ ...h, estimatedStartTime: undefined })),
    }));
    (globalThis as Record<string, unknown>).__mockScheduleData = {
      entries: noTimeEntries,
      maxMinutesWithoutBreak: 360,
    };

    render(<JudgeScheduleView competitionId={1} />);

    expect(await screen.findByText(/Set a start time/)).toBeInTheDocument();
  });

  it('should show judge names and numbers in the list', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    // Full names appear in the judge list
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    // J1/J2 appear in both timeline and list (use getAllByText)
    expect(screen.getAllByText('J1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('J2').length).toBeGreaterThanOrEqual(1);
  });

  it('should show chairman badge', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    expect(await screen.findByText('Chair')).toBeInTheDocument();
  });

  it('should show heat count and working minutes per judge', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    expect(await screen.findByText('2 heats')).toBeInTheDocument();
    expect(screen.getByText('3 heats')).toBeInTheDocument();
    expect(screen.getByText('30min')).toBeInTheDocument();
    expect(screen.getByText('400min')).toBeInTheDocument();
  });

  it('should show segment durations in summary', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    // Bob has two segments: 30m and 370m
    expect(await screen.findByText('370m')).toBeInTheDocument();
  });

  it('should show warning indicator for exceeding judges', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    // Exclamation mark for exceeded limit
    expect(await screen.findByText('!')).toBeInTheDocument();
  });

  it('should expand heat list when clicking Show', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    // Click Show for Alice (first judge)
    const showButtons = await screen.findAllByRole('button', { name: 'Show' });
    fireEvent.click(showButtons[0]);

    // Should show heat details
    expect(await screen.findByText('Bronze Waltz')).toBeInTheDocument();
    expect(screen.getByText('Silver Tango')).toBeInTheDocument();
  });

  it('should show time column in expanded view when timing data is available', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    const showButtons = await screen.findAllByRole('button', { name: 'Show' });
    fireEvent.click(showButtons[0]);

    // Should show Time header
    expect(await screen.findByText('Time')).toBeInTheDocument();
  });

  it('should collapse heat list when clicking Hide', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    const showButtons = await screen.findAllByRole('button', { name: 'Show' });
    fireEvent.click(showButtons[0]);

    expect(await screen.findByText('Bronze Waltz')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Bronze Waltz')).not.toBeInTheDocument();
  });

  it('should show hour labels in the timeline', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    // The timeline renders hour labels (exact hours depend on timezone)
    // Just verify that AM/PM labels are present
    const amLabels = await screen.findAllByText(/\d+ [AP]M/);
    expect(amLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('should show exceeds limit text in legend', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    expect(await screen.findByText('Exceeds 6h limit')).toBeInTheDocument();
  });

  it('should show judge first names in timeline rows', async () => {
    render(<JudgeScheduleView competitionId={1} />);

    // Timeline uses first names
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
