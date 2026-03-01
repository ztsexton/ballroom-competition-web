import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockGetAllJudges = vi.fn();

vi.mock('../api/client', () => ({
  judgesApi: {
    getAll: (...args: unknown[]) => mockGetAllJudges(...args),
    create: vi.fn(() => Promise.resolve({ data: {} })),
    update: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
  },
  judgeProfilesApi: {
    getAll: vi.fn(() => Promise.resolve({ data: [] })),
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

import { JudgesPage } from '../pages/participants';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('JudgesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockActiveCompetition = null;
  });

  it('should show "select a competition" when no competition is active', () => {
    render(
      <RouterWrapper>
        <JudgesPage />
      </RouterWrapper>
    );

    expect(screen.getByText(/select a competition/i)).toBeInTheDocument();
  });

  it('should show judges list when competition is active', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllJudges.mockResolvedValue({
      data: [
        { id: 1, name: 'Judge Alpha', judgeNumber: 1, competitionId: 1 },
        { id: 2, name: 'Judge Beta', judgeNumber: 2, competitionId: 1 },
      ],
    });

    render(
      <RouterWrapper>
        <JudgesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Judge Alpha')).toBeInTheDocument();
    expect(screen.getByText('Judge Beta')).toBeInTheDocument();
  });

  it('should show empty state when no judges exist', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllJudges.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <JudgesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/no judges/i)).toBeInTheDocument();
  });

  it('should show add judge form', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Test Comp', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllJudges.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <JudgesPage />
      </RouterWrapper>
    );

    await screen.findByText(/no judges/i);
    expect(screen.getByPlaceholderText(/judge name/i)).toBeInTheDocument();
  });
});
