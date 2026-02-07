import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Competition } from '../types';

// Mock useParams to return empty (new event mode)
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({}),
    useNavigate: () => vi.fn(),
  };
});

// Mock the auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    loading: false,
  }),
}));

// Mock the API client - inline to avoid hoisting issues
vi.mock('../api/client', () => ({
  eventsApi: {
    getById: vi.fn(() => Promise.resolve({ data: { id: 1, name: 'Test Event', heats: [{ bibs: [], judges: [] }] } })),
    create: vi.fn(() => Promise.resolve({ data: { id: 1 } })),
    update: vi.fn(() => Promise.resolve({ data: { id: 1 } })),
  },
  couplesApi: {
    getAll: vi.fn(() => Promise.resolve({
      data: [{ bib: 1, leaderName: 'Leader', followerName: 'Follower', competitionId: 1, leaderId: 1, followerId: 2 }]
    })),
  },
  judgesApi: {
    getAll: vi.fn(() => Promise.resolve({
      data: [{ id: 1, name: 'Judge 1', judgeNumber: 1, competitionId: 1 }]
    })),
  },
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

// Import component after all mocks are set up
import { EventFormPage } from '../pages/events';

describe('EventFormPage - Level Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockActiveCompetition = null;
  });

  it('should show Syllabus Type toggle when levelMode is combined', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1,
      name: 'Combined Comp',
      type: 'NDCA',
      date: '2026-06-01',
      levelMode: 'combined',
      levels: ['Bronze', 'Silver', 'Gold'],
      createdAt: '2026-01-01',
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <EventFormPage />
      </MemoryRouter>
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByText('Scoring Type')).toBeInTheDocument();
    });

    // Should show Syllabus Type label
    expect(screen.getByText('Syllabus Type')).toBeInTheDocument();

    // Should show Syllabus and Open buttons
    expect(screen.getByRole('button', { name: 'Syllabus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('should hide Syllabus Type toggle when levelMode is integrated', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 2,
      name: 'Integrated Comp',
      type: 'NDCA',
      date: '2026-06-01',
      levelMode: 'integrated',
      levels: ['Bronze 1', 'Bronze 2', 'Open Bronze', 'Silver 1', 'Silver 2', 'Open Silver'],
      createdAt: '2026-01-01',
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <EventFormPage />
      </MemoryRouter>
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByText('Scoring Type')).toBeInTheDocument();
    });

    // Should NOT show Syllabus Type label
    expect(screen.queryByText('Syllabus Type')).not.toBeInTheDocument();

    // Should show Open level options in the levels list instead
    expect(screen.getByRole('button', { name: 'Open Bronze' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Silver' })).toBeInTheDocument();
  });

  it('should default to combined mode when levelMode is not set', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 3,
      name: 'No Mode Comp',
      type: 'NDCA',
      date: '2026-06-01',
      levels: ['Bronze', 'Silver', 'Gold'],
      createdAt: '2026-01-01',
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <EventFormPage />
      </MemoryRouter>
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByText('Scoring Type')).toBeInTheDocument();
    });

    // Should show Syllabus Type label (default combined behavior)
    expect(screen.getByText('Syllabus Type')).toBeInTheDocument();
  });

  it('should show level buttons from integrated levels list', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 4,
      name: 'Full Integrated Comp',
      type: 'NDCA',
      date: '2026-06-01',
      levelMode: 'integrated',
      levels: ['Bronze 1', 'Bronze 2', 'Bronze 3', 'Open Bronze', 'Silver 1', 'Open Silver', 'Gold', 'Open Gold'],
      createdAt: '2026-01-01',
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <EventFormPage />
      </MemoryRouter>
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByText('Scoring Type')).toBeInTheDocument();
    });

    // Should show all levels including Open variants
    expect(screen.getByRole('button', { name: 'Bronze 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Bronze' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Silver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Gold' })).toBeInTheDocument();

    // Should NOT show separate Syllabus Type toggle
    expect(screen.queryByText('Syllabus Type')).not.toBeInTheDocument();
  });
});
