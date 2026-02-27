import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetAllCompetitions = vi.fn();
const mockGetEvents = vi.fn();
const mockGetPeople = vi.fn();
const mockSearchByDancer = vi.fn();
const mockGetDetailedEventResults = vi.fn();

vi.mock('../api/client', () => ({
  publicCompetitionsApi: {
    getAll: (...args: unknown[]) => mockGetAllCompetitions(...args),
    getById: vi.fn(() => Promise.resolve({
      data: { id: 1, name: 'Test Comp', date: '2025-06-01', type: 'UNAFFILIATED' },
    })),
    getEvents: (...args: unknown[]) => mockGetEvents(...args),
    getPeople: (...args: unknown[]) => mockGetPeople(...args),
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
    isAnyAdmin: false,
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

  it('should show competition detail with tabbed views and event list', async () => {
    mockGetPeople.mockResolvedValue({
      data: [
        { id: 1, firstName: 'John', lastName: 'Smith', partnerships: [{ bib: 101, partnerName: 'Jane Doe' }] },
        { id: 2, firstName: 'Jane', lastName: 'Doe', partnerships: [{ bib: 101, partnerName: 'John Smith' }] },
      ],
    });
    mockGetEvents.mockResolvedValue({
      data: [
        { id: 1, name: 'Waltz', rounds: ['final'], coupleCount: 4 },
        { id: 2, name: 'Tango', rounds: ['semi-final', 'final'], coupleCount: 8 },
      ],
    });

    renderWithRoute('/results/1');

    // Default view is "By Person" — tabs should be visible
    expect(await screen.findByText('By Person')).toBeInTheDocument();
    expect(screen.getByText('By Event')).toBeInTheDocument();

    // Default By Person tab shows individual people sorted by last name
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();

    // Switch to "By Event" tab to see events
    await userEvent.click(screen.getByText('By Event'));

    expect(await screen.findByText('Waltz')).toBeInTheDocument();
    expect(screen.getByText('Tango')).toBeInTheDocument();
  });

  it('should show loading state on competition list', () => {
    mockGetAllCompetitions.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithRoute('/results');

    // Loading state now renders a skeleton instead of text
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
