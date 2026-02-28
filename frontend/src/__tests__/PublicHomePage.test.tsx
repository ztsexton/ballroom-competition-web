import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetAll = vi.fn();

vi.mock('../api/client', () => ({
  publicCompetitionsApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}));

import PublicHomePage from '../pages/public/PublicHomePage';

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PublicHomePage />
    </MemoryRouter>
  );
}

describe('PublicHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the hero heading and tagline', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    renderPage();

    expect(await screen.findByText('Ballroom Scorer')).toBeInTheDocument();
    expect(
      screen.getByText('Competition management, scoring, and results for ballroom dance')
    ).toBeInTheDocument();
  });

  it('should render section headings after loading', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    renderPage();

    expect(await screen.findByText('Upcoming Competitions')).toBeInTheDocument();
    expect(screen.getByText('Recent Results')).toBeInTheDocument();
  });

  it('should show loading skeletons while data is being fetched', () => {
    mockGetAll.mockReturnValue(new Promise(() => {})); // never resolves

    renderPage();

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show empty state messages when no competitions exist', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    renderPage();

    expect(await screen.findByText('No upcoming competitions.')).toBeInTheDocument();
    expect(screen.getByText('No recent competitions.')).toBeInTheDocument();
  });

  it('should render upcoming competitions as links', async () => {
    mockGetAll.mockImplementation((scope: unknown) => {
      if (scope === 'upcoming') {
        return Promise.resolve({
          data: [
            { id: 1, name: 'Spring Classic', date: '2026-04-15', type: 'NDCA', location: 'New York, NY' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderPage();

    const link = await screen.findByRole('link', { name: /Spring Classic/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/competition/1');
  });

  it('should render recent competitions as links pointing to results', async () => {
    mockGetAll.mockImplementation((scope: unknown) => {
      if (scope === 'recent') {
        return Promise.resolve({
          data: [
            { id: 2, name: 'Fall Open', date: '2025-11-10', type: 'USA_DANCE' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderPage();

    const link = await screen.findByRole('link', { name: /Fall Open/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/results/2');
  });

  it('should display competition location when provided', async () => {
    mockGetAll.mockImplementation((scope: unknown) => {
      if (scope === 'upcoming') {
        return Promise.resolve({
          data: [
            { id: 3, name: 'Summer Cup', date: '2026-07-01', type: 'WDC', location: 'Chicago, IL' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderPage();

    expect(await screen.findByText('Summer Cup')).toBeInTheDocument();
    expect(screen.getByText(/Chicago, IL/)).toBeInTheDocument();
  });

  it('should display competition description when provided', async () => {
    mockGetAll.mockImplementation((scope: unknown) => {
      if (scope === 'upcoming') {
        return Promise.resolve({
          data: [
            {
              id: 4,
              name: 'Winter Ball',
              date: '2026-12-05',
              type: 'STUDIO',
              description: 'An elegant end-of-year showcase',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderPage();

    expect(await screen.findByText('Winter Ball')).toBeInTheDocument();
    expect(screen.getByText('An elegant end-of-year showcase')).toBeInTheDocument();
  });

  it('should call publicCompetitionsApi.getAll with correct scope arguments', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    renderPage();

    await screen.findByText('Upcoming Competitions');

    expect(mockGetAll).toHaveBeenCalledWith('upcoming');
    expect(mockGetAll).toHaveBeenCalledWith('recent');
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  });
});
