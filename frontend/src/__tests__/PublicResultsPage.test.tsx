import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetAllCompetitions = vi.fn();
const mockGetEvents = vi.fn();
const mockSearchByDancer = vi.fn();
const mockGetDetailedEventResults = vi.fn();

vi.mock('../api/client', () => ({
  publicCompetitionsApi: {
    getAll: (...args: unknown[]) => mockGetAllCompetitions(...args),
    getById: vi.fn(() => Promise.resolve({
      data: { id: 1, name: 'Test Comp', date: '2025-06-01', type: 'UNAFFILIATED' },
    })),
    getEvents: (...args: unknown[]) => mockGetEvents(...args),
    getDetailedEventResults: (...args: unknown[]) => mockGetDetailedEventResults(...args),
    searchByDancer: (...args: unknown[]) => mockSearchByDancer(...args),
  },
  participantApi: {
    getProfile: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    loading: false,
  }),
}));

// Mock MultiDanceSummary to avoid deep rendering
vi.mock('../components/results/MultiDanceSummary', () => ({
  MultiDanceSummary: () => <div data-testid="multi-dance-summary">Multi Dance Summary</div>,
}));

import PublicResultsPage from '../pages/public/PublicResultsPage';

function renderWithRoute(path = '/results') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/results" element={<PublicResultsPage />} />
        <Route path="/results/:competitionId" element={<PublicResultsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render competition list view', async () => {
    mockGetAllCompetitions.mockResolvedValue({
      data: [
        { id: 1, name: 'Spring Classic', date: '2025-06-01', type: 'NDCA' },
        { id: 2, name: 'Fall Open', date: '2025-09-15', type: 'USA_DANCE' },
      ],
    });

    renderWithRoute('/results');

    expect(await screen.findByText('Spring Classic')).toBeInTheDocument();
    expect(screen.getByText('Fall Open')).toBeInTheDocument();
  });

  it('should show "No competitions found" when empty', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    renderWithRoute('/results');

    expect(await screen.findByText(/No competitions found/i)).toBeInTheDocument();
  });

  it('should show competition detail with event list', async () => {
    mockGetEvents.mockResolvedValue({
      data: [
        { id: 1, name: 'Waltz', rounds: ['final'], coupleCount: 4 },
        { id: 2, name: 'Tango', rounds: ['semi-final', 'final'], coupleCount: 8 },
      ],
    });

    renderWithRoute('/results/1');

    expect(await screen.findByText('Waltz')).toBeInTheDocument();
    expect(screen.getByText('Tango')).toBeInTheDocument();
  });

  it('should show loading state on competition list', () => {
    mockGetAllCompetitions.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithRoute('/results');

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
