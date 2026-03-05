import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock the auth context with dynamic values via globalThis
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: (globalThis as any).__mockIsAdmin ?? true,
    isAnyAdmin: (globalThis as any).__mockIsAnyAdmin ?? true,
    loading: false,
  }),
}));

// Mock the toast context
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock the competition context
vi.mock('../context/CompetitionContext', () => ({
  useCompetition: () => ({
    activeCompetition: null,
    competitions: [],
    setActiveCompetition: vi.fn(),
    loading: false,
    refreshCompetitions: vi.fn(),
  }),
}));

// Mock the API client
const mockGetAllCompetitions = vi.fn();
const mockGetAllStudios = vi.fn();
const mockGetAllOrganizations = vi.fn();

vi.mock('../api/client', () => ({
  competitionsApi: {
    getAll: (...args: unknown[]) => mockGetAllCompetitions(...args),
    create: vi.fn(),
    delete: vi.fn(),
  },
  studiosApi: {
    getAll: (...args: unknown[]) => mockGetAllStudios(...args),
  },
  organizationsApi: {
    getAll: (...args: unknown[]) => mockGetAllOrganizations(...args),
  },
}));

// Import component after all mocks are set up
import { CompetitionsPage } from '../pages/competitions';

// Router wrapper with v7 future flags to suppress deprecation warnings
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('CompetitionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockIsAdmin = true;
    (globalThis as any).__mockIsAnyAdmin = true;
  });

  it('should show loading skeleton while loading', () => {
    // Mock getAll to never resolve so loading stays true
    mockGetAllCompetitions.mockReturnValue(new Promise(() => {}));
    mockGetAllStudios.mockReturnValue(new Promise(() => {}));
    mockGetAllOrganizations.mockReturnValue(new Promise(() => {}));

    render(
      <RouterWrapper>
        <CompetitionsPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show Access Denied when not admin', async () => {
    (globalThis as any).__mockIsAdmin = false;
    (globalThis as any).__mockIsAnyAdmin = false;

    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
  });

  it('should show empty state when no competitions exist', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });
    mockGetAllStudios.mockResolvedValue({ data: [] });
    mockGetAllOrganizations.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No competitions created yet')).toBeInTheDocument();
  });

  it('should display competition names when data loads', async () => {
    mockGetAllCompetitions.mockResolvedValue({
      data: [
        { id: 1, name: 'Spring Championship', type: 'NDCA', date: '2026-03-15', createdAt: '2026-01-01' },
        { id: 2, name: 'Fall Classic', type: 'USA_DANCE', date: '2026-10-20', createdAt: '2026-01-01' },
      ],
    });
    mockGetAllStudios.mockResolvedValue({ data: [] });
    mockGetAllOrganizations.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Spring Championship')).toBeInTheDocument();
    expect(screen.getByText('Fall Classic')).toBeInTheDocument();
  });

  it('should show "+ New Competition" button for site admins', async () => {
    (globalThis as any).__mockIsAdmin = true;
    (globalThis as any).__mockIsAnyAdmin = true;

    mockGetAllCompetitions.mockResolvedValue({ data: [] });
    mockGetAllStudios.mockResolvedValue({ data: [] });
    mockGetAllOrganizations.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No competitions created yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ New Competition/i })).toBeInTheDocument();
  });

  it('should NOT show "+ New Competition" button for competition-only admins', async () => {
    (globalThis as any).__mockIsAdmin = false;
    (globalThis as any).__mockIsAnyAdmin = true;

    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <CompetitionsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No competitions created yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ New Competition/i })).not.toBeInTheDocument();
  });
});
