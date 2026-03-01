import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetById = vi.fn();
const mockGetHeats = vi.fn();

vi.mock('../api/client', () => ({
  publicCompetitionsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getHeats: (...args: unknown[]) => mockGetHeats(...args),
  },
}));

import PublicHeatListsPage from '../pages/public/PublicHeatListsPage';

function renderWithRoute(competitionId = '1') {
  return render(
    <MemoryRouter
      initialEntries={[`/heats/${competitionId}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/heats/:competitionId" element={<PublicHeatListsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicHeatListsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show a loading skeleton while data is fetching', () => {
    mockGetById.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithRoute();

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show "Competition not found" when getById rejects', async () => {
    mockGetById.mockRejectedValue(new Error('Not found'));

    renderWithRoute();

    expect(await screen.findByText('Competition not found.')).toBeInTheDocument();
  });

  it('should show "not published" message when heatListsPublished is false', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: false,
      },
    });

    renderWithRoute();

    expect(
      await screen.findByText('Heat lists have not been published yet.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Check back closer to competition day once entries are finalized/)
    ).toBeInTheDocument();
  });

  it('should show "not published" message when getHeats returns 403', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });

    const axiosError = Object.assign(new Error('Forbidden'), {
      isAxiosError: true,
      response: { status: 403 },
    });
    mockGetHeats.mockRejectedValue(axiosError);

    // Make axios.isAxiosError return true for our fake error
    const axiosMod = await import('axios');
    vi.spyOn(axiosMod.default, 'isAxiosError').mockReturnValue(true);

    renderWithRoute();

    expect(
      await screen.findByText('Heat lists have not been published yet.')
    ).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('should show "No events scheduled yet" when events list is empty', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({ data: [] });

    renderWithRoute();

    expect(
      await screen.findByText('No events scheduled yet. Check back closer to competition day.')
    ).toBeInTheDocument();
  });

  it('should render competition name and date in the header', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01T00:00:00.000Z',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({ data: [] });

    renderWithRoute();

    expect(await screen.findByText('Program')).toBeInTheDocument();
    expect(screen.getByText(/Spring Classic/)).toBeInTheDocument();
  });

  it('should render the back link to the competition results page', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({ data: [] });

    renderWithRoute('1');

    const backLink = await screen.findByRole('link', { name: /Back to competition/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/results/1');
  });

  it('should render events grouped by style with event names visible', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({
      data: [
        {
          id: 10,
          name: 'Bronze Waltz',
          style: 'Smooth',
          level: 'Bronze',
          dances: ['Waltz'],
          rounds: ['final'],
          coupleCount: 4,
          heats: [
            {
              round: 'final',
              couples: [
                { bib: 101, leaderName: 'John Smith', followerName: 'Jane Doe' },
              ],
            },
          ],
        },
        {
          id: 11,
          name: 'Silver Tango',
          style: 'Smooth',
          level: 'Silver',
          dances: ['Tango'],
          rounds: ['semi-final', 'final'],
          coupleCount: 8,
          heats: [
            {
              round: 'semi-final',
              couples: [
                { bib: 102, leaderName: 'Alice Brown', followerName: 'Bob Green' },
              ],
            },
            {
              round: 'final',
              couples: [
                { bib: 102, leaderName: 'Alice Brown', followerName: 'Bob Green' },
              ],
            },
          ],
        },
        {
          id: 12,
          name: 'Bronze Cha Cha',
          style: 'Latin',
          level: 'Bronze',
          dances: ['Cha Cha'],
          rounds: ['final'],
          coupleCount: 3,
          heats: [
            {
              round: 'final',
              couples: [
                { bib: 103, leaderName: 'Tom White', followerName: 'Sara Black' },
              ],
            },
          ],
        },
      ],
    });

    renderWithRoute();

    // Style group headers should appear
    expect(await screen.findByText('Smooth')).toBeInTheDocument();
    expect(screen.getByText('Latin')).toBeInTheDocument();

    // Event names should appear collapsed (not expanded yet)
    expect(screen.getByText('Bronze Waltz')).toBeInTheDocument();
    expect(screen.getByText('Silver Tango')).toBeInTheDocument();
    expect(screen.getByText('Bronze Cha Cha')).toBeInTheDocument();

    // Couple data should NOT be visible until expanded
    expect(screen.queryByText('John Smith & Jane Doe')).not.toBeInTheDocument();
  });

  it('should expand an event to show heat couples when clicked', async () => {
    const user = userEvent.setup();

    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({
      data: [
        {
          id: 10,
          name: 'Bronze Waltz',
          style: 'Smooth',
          level: 'Bronze',
          dances: ['Waltz'],
          rounds: ['final'],
          coupleCount: 2,
          heats: [
            {
              round: 'final',
              couples: [
                { bib: 101, leaderName: 'John Smith', followerName: 'Jane Doe' },
                { bib: 102, leaderName: 'Alice Brown', followerName: 'Bob Green' },
              ],
            },
          ],
        },
      ],
    });

    renderWithRoute();

    // Wait for render
    const eventRow = await screen.findByText('Bronze Waltz');

    // Couple names not visible before expanding
    expect(screen.queryByText('John Smith & Jane Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice Brown & Bob Green')).not.toBeInTheDocument();

    // Click to expand
    await user.click(eventRow);

    // Couple names appear after expanding
    expect(await screen.findByText('John Smith & Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Alice Brown & Bob Green')).toBeInTheDocument();

    // Multiple "final" texts exist (badge + round heading), so use getAllByText
    const finalElements = screen.getAllByText('final');
    expect(finalElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show round labels for multi-round events when expanded', async () => {
    const user = userEvent.setup();

    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({
      data: [
        {
          id: 20,
          name: 'Silver Tango',
          style: 'Smooth',
          level: 'Silver',
          dances: ['Tango'],
          rounds: ['semi-final', 'final'],
          coupleCount: 6,
          heats: [
            {
              round: 'semi-final',
              couples: [{ bib: 201, leaderName: 'Chris Lee', followerName: 'Dana Park' }],
            },
            {
              round: 'final',
              couples: [{ bib: 201, leaderName: 'Chris Lee', followerName: 'Dana Park' }],
            },
          ],
        },
      ],
    });

    renderWithRoute();

    await user.click(await screen.findByText('Silver Tango'));

    // Both round labels visible after expansion.
    // The rounds badge shows "semi final, final" and the expanded round headers
    // also show "semi final" and "final" separately — use getAllByText.
    expect((await screen.findAllByText('semi final')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('final').length).toBeGreaterThanOrEqual(1);
  });

  it('should show correct couple count label in event subtitle', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({
      data: [
        {
          id: 30,
          name: 'Open Viennese Waltz',
          style: 'Smooth',
          level: 'Open',
          dances: ['Viennese Waltz'],
          rounds: ['final'],
          coupleCount: 1,
          heats: [
            {
              round: 'final',
              couples: [{ bib: 301, leaderName: 'Eve Adams', followerName: 'Frank Castle' }],
            },
          ],
        },
      ],
    });

    renderWithRoute();

    // coupleCount === 1 → singular "couple".
    // The subtitle div contains mixed text nodes; query for the event name first
    // then verify the parent container's textContent includes "1 couple" (not "couples").
    await screen.findByText('Open Viennese Waltz');
    const subtitleDiv = document.querySelector('.text-xs.text-gray-500');
    expect(subtitleDiv?.textContent).toContain('1 couple');
    expect(subtitleDiv?.textContent).not.toMatch(/1 couples/);
  });

  it('should show plural couples label when coupleCount > 1', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({
      data: [
        {
          id: 31,
          name: 'Gold Foxtrot',
          style: 'Smooth',
          level: 'Gold',
          dances: ['Foxtrot'],
          rounds: ['final'],
          coupleCount: 5,
          heats: [
            {
              round: 'final',
              couples: [],
            },
          ],
        },
      ],
    });

    renderWithRoute();

    expect(await screen.findByText(/5 couples/)).toBeInTheDocument();
  });

  it('should group events without a style under "Other"', async () => {
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({
      data: [
        {
          id: 40,
          name: 'Mystery Dance',
          style: undefined,
          level: 'Bronze',
          dances: ['Waltz'],
          rounds: ['final'],
          coupleCount: 2,
          heats: [],
        },
      ],
    });

    renderWithRoute();

    expect(await screen.findByText('Other')).toBeInTheDocument();
    expect(screen.getByText('Mystery Dance')).toBeInTheDocument();
  });

  it('should collapse an already-expanded event when clicked again', async () => {
    const user = userEvent.setup();

    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Spring Classic',
        date: '2025-06-01',
        type: 'NDCA',
        heatListsPublished: true,
      },
    });
    mockGetHeats.mockResolvedValue({
      data: [
        {
          id: 50,
          name: 'Bronze Quickstep',
          style: 'Smooth',
          level: 'Bronze',
          dances: ['Quickstep'],
          rounds: ['final'],
          coupleCount: 1,
          heats: [
            {
              round: 'final',
              couples: [{ bib: 501, leaderName: 'Greg Hall', followerName: 'Hannah Ivy' }],
            },
          ],
        },
      ],
    });

    renderWithRoute();

    const eventHeader = await screen.findByText('Bronze Quickstep');

    // Expand
    await user.click(eventHeader);
    expect(await screen.findByText('Greg Hall & Hannah Ivy')).toBeInTheDocument();

    // Collapse
    await user.click(eventHeader);
    expect(screen.queryByText('Greg Hall & Hannah Ivy')).not.toBeInTheDocument();
  });
});
