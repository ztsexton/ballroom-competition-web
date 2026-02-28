import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockGetAllPeople = vi.fn();
const mockGetAllStudios = vi.fn();

vi.mock('../api/client', () => ({
  peopleApi: {
    getAll: (...args: unknown[]) => mockGetAllPeople(...args),
    create: vi.fn(() => Promise.resolve({ data: {} })),
    update: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
  },
  studiosApi: {
    getAll: (...args: unknown[]) => mockGetAllStudios(...args),
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
    isAdmin: (globalThis as any).__mockIsAdmin ?? true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

import { PeoplePage } from '../pages/participants';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('PeoplePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockActiveCompetition = null;
    (globalThis as any).__mockIsAdmin = true;
    mockGetAllStudios.mockResolvedValue({ data: [] });
  });

  it('should show loading skeleton when no competition is active', () => {
    render(
      <RouterWrapper>
        <PeoplePage />
      </RouterWrapper>
    );

    // No competition => loading false, shows "select a competition"
    expect(screen.getByText(/select a competition/i)).toBeInTheDocument();
  });

  it('should show people list when competition is active', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllPeople.mockResolvedValue({
      data: [
        { id: 1, firstName: 'Alice', lastName: 'Smith', role: 'leader', status: 'student', competitionId: 1 },
        { id: 2, firstName: 'Bob', lastName: 'Jones', role: 'follower', status: 'professional', competitionId: 1 },
      ],
    });

    render(
      <RouterWrapper>
        <PeoplePage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should show empty state when no people exist', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllPeople.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <PeoplePage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/no people/i)).toBeInTheDocument();
  });

  it('should show add person form', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllPeople.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <PeoplePage />
      </RouterWrapper>
    );

    await screen.findByText(/no people/i);
    // Labels are rendered as text (not linked via htmlFor), verify form fields exist
    const firstNameLabels = screen.getAllByText(/first name/i);
    expect(firstNameLabels.length).toBeGreaterThanOrEqual(1);
    const lastNameLabels = screen.getAllByText(/last name/i);
    expect(lastNameLabels.length).toBeGreaterThanOrEqual(1);
  });
});
