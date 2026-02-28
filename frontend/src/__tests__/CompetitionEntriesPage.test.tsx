import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockGetAllPeople = vi.fn();
const mockGetAllCouples = vi.fn();
const mockGetAllJudges = vi.fn();
const mockGetAllStudios = vi.fn();

vi.mock('../api/client', () => ({
  peopleApi: {
    getAll: (...args: unknown[]) => mockGetAllPeople(...args),
    create: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
  },
  couplesApi: {
    getAll: (...args: unknown[]) => mockGetAllCouples(...args),
    create: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
    getEvents: vi.fn(() => Promise.resolve({ data: [] })),
    getEligibleCategories: vi.fn(() => Promise.resolve({ data: { categories: [] } })),
  },
  judgesApi: {
    getAll: (...args: unknown[]) => mockGetAllJudges(...args),
    create: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
  },
  studiosApi: {
    getAll: (...args: unknown[]) => mockGetAllStudios(...args),
  },
  eventsApi: {
    register: vi.fn(() => Promise.resolve({ data: { event: {}, created: true } })),
    removeEntry: vi.fn(() => Promise.resolve({})),
  },
  mindbodyApi: {
    getClients: vi.fn(() => Promise.resolve({ data: { clients: [], total: 0 } })),
    importClients: vi.fn(() => Promise.resolve({ data: { imported: 0, people: [] } })),
  },
}));

const getMockCompetition = () => (globalThis as any).__mockActiveCompetition || null;

vi.mock('../context/CompetitionContext', () => ({
  useCompetition: () => ({
    activeCompetition: getMockCompetition(),
    setActiveCompetition: vi.fn(),
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

import CompetitionEntriesPage from '../pages/competitions/CompetitionEntriesPage';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('CompetitionEntriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockActiveCompetition = null;
  });

  it('should show loading skeleton when no competition is active', () => {
    render(
      <RouterWrapper>
        <CompetitionEntriesPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show tabs when competition is active', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllPeople.mockResolvedValue({
      data: [
        { id: 1, firstName: 'John', lastName: 'Doe', role: 'leader', status: 'student', competitionId: 1 },
      ],
    });
    mockGetAllCouples.mockResolvedValue({ data: [] });
    mockGetAllJudges.mockResolvedValue({ data: [] });
    mockGetAllStudios.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByRole('button', { name: /^People/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Couples/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Judges/ })).toBeInTheDocument();
  });

  it('should display people in the people tab', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllPeople.mockResolvedValue({
      data: [
        { id: 1, firstName: 'Alice', lastName: 'Smith', role: 'leader', status: 'student', competitionId: 1 },
        { id: 2, firstName: 'Bob', lastName: 'Jones', role: 'follower', status: 'professional', competitionId: 1 },
      ],
    });
    mockGetAllCouples.mockResolvedValue({ data: [] });
    mockGetAllJudges.mockResolvedValue({ data: [] });
    mockGetAllStudios.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should display couples when couples tab data loads', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllPeople.mockResolvedValue({
      data: [
        { id: 1, firstName: 'Alice', lastName: 'Smith', role: 'leader', status: 'student', competitionId: 1 },
        { id: 2, firstName: 'Bob', lastName: 'Jones', role: 'follower', status: 'student', competitionId: 1 },
      ],
    });
    mockGetAllCouples.mockResolvedValue({
      data: [
        { bib: 101, leaderId: 1, followerId: 2, leaderName: 'Alice Smith', followerName: 'Bob Jones', competitionId: 1 },
      ],
    });
    mockGetAllJudges.mockResolvedValue({ data: [] });
    mockGetAllStudios.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionEntriesPage />
      </RouterWrapper>
    );

    // Wait for data to load, then switch to couples tab
    const couplesTab = await screen.findByRole('button', { name: /^Couples/ });
    fireEvent.click(couplesTab);
    expect(await screen.findByText('#101')).toBeInTheDocument();
  });

  it('should show add person form', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllPeople.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [] });
    mockGetAllJudges.mockResolvedValue({ data: [] });
    mockGetAllStudios.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionEntriesPage />
      </RouterWrapper>
    );

    // Wait for loading to finish - add person form should be visible
    expect(await screen.findByRole('button', { name: /^People/ })).toBeInTheDocument();
    // Labels are rendered as text (not linked via htmlFor), verify form fields exist
    const firstNameLabels = screen.getAllByText(/first name/i);
    expect(firstNameLabels.length).toBeGreaterThanOrEqual(1);
    const lastNameLabels = screen.getAllByText(/last name/i);
    expect(lastNameLabels.length).toBeGreaterThanOrEqual(1);
  });
});
