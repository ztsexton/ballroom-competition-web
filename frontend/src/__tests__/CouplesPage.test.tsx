import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockGetAllCouples = vi.fn();
const mockGetAllPeople = vi.fn();

vi.mock('../api/client', () => ({
  couplesApi: {
    getAll: (...args: unknown[]) => mockGetAllCouples(...args),
    create: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
  },
  peopleApi: {
    getAll: (...args: unknown[]) => mockGetAllPeople(...args),
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

import { CouplesPage } from '../pages/participants';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('CouplesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockActiveCompetition = null;
  });

  it('should show "select a competition" when no competition is active', () => {
    render(
      <RouterWrapper>
        <CouplesPage />
      </RouterWrapper>
    );

    expect(screen.getByText(/select a competition/i)).toBeInTheDocument();
  });

  it('should show couples list when competition is active', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllCouples.mockResolvedValue({
      data: [
        { bib: 101, leaderId: 1, followerId: 2, leaderName: 'Alice Smith', followerName: 'Bob Jones', competitionId: 1 },
      ],
    });
    mockGetAllPeople.mockResolvedValue({
      data: [
        { id: 1, firstName: 'Alice', lastName: 'Smith', role: 'leader', status: 'student', competitionId: 1 },
        { id: 2, firstName: 'Bob', lastName: 'Jones', role: 'follower', status: 'student', competitionId: 1 },
      ],
    });

    render(
      <RouterWrapper>
        <CouplesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('#101')).toBeInTheDocument();
    expect(screen.getAllByText(/Alice Smith/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Bob Jones/).length).toBeGreaterThanOrEqual(1);
  });

  it('should show empty state when no couples exist', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllCouples.mockResolvedValue({ data: [] });
    mockGetAllPeople.mockResolvedValue({
      data: [
        { id: 1, firstName: 'Alice', lastName: 'Smith', role: 'leader', status: 'student', competitionId: 1 },
      ],
    });

    render(
      <RouterWrapper>
        <CouplesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/no couples/i)).toBeInTheDocument();
  });

  it('should show the couple creation form with leader/follower dropdowns', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllCouples.mockResolvedValue({ data: [] });
    mockGetAllPeople.mockResolvedValue({
      data: [
        { id: 1, firstName: 'Alice', lastName: 'Smith', role: 'leader', status: 'student', competitionId: 1 },
        { id: 2, firstName: 'Bob', lastName: 'Jones', role: 'follower', status: 'student', competitionId: 1 },
      ],
    });

    render(
      <RouterWrapper>
        <CouplesPage />
      </RouterWrapper>
    );

    // Wait for data to load
    await screen.findByText(/no couples/i);

    // Should have leader and follower select dropdowns
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });
});
