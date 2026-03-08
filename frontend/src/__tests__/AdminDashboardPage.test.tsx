import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock auth context with dynamic values via globalThis
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: (globalThis as any).__mockIsAdmin ?? true,
    isAnyAdmin: (globalThis as any).__mockIsAnyAdmin ?? true,
    loading: false,
  }),
}));

// Create mock fn BEFORE vi.mock
const mockGetAllCompetitions = vi.fn();

vi.mock('../api/client', () => ({
  competitionsApi: {
    getAll: (...args: unknown[]) => mockGetAllCompetitions(...args),
  },
  databaseApi: {
    getStagingBypass: () => Promise.resolve({ data: { enabled: false } }),
    setStagingBypass: () => Promise.resolve({ data: { enabled: false } }),
  },
  isStagingBypassActive: () => false,
  setStagingBypassActive: vi.fn(),
}));

// Import component AFTER mocks
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';

// Router wrapper with v7 future flags to suppress deprecation warnings
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockIsAdmin = true;
    (globalThis as any).__mockIsAnyAdmin = true;
  });

  it('should show loading skeleton while data is loading', () => {
    mockGetAllCompetitions.mockReturnValue(new Promise(() => {}));

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should render the Admin Dashboard heading after loading', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('should render the page description', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    expect(screen.getByText('Manage competitions and site settings.')).toBeInTheDocument();
  });

  it('should show Site Administration section with Users, Studios, Organizations cards for site admins', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    expect(screen.getByText('Site Administration')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Studios')).toBeInTheDocument();
    expect(screen.getByText('Organizations')).toBeInTheDocument();
  });

  it('should link Users card to /users', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    const usersLink = screen.getByRole('link', { name: /users/i });
    expect(usersLink).toHaveAttribute('href', '/users');
  });

  it('should link Studios card to /studios', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    const studiosLink = screen.getByRole('link', { name: /studios/i });
    expect(studiosLink).toHaveAttribute('href', '/studios');
  });

  it('should link Organizations card to /organizations', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    const orgsLink = screen.getByRole('link', { name: /organizations/i });
    expect(orgsLink).toHaveAttribute('href', '/organizations');
  });

  it('should NOT show Site Administration section for competition-only admins', async () => {
    (globalThis as any).__mockIsAdmin = false;
    (globalThis as any).__mockIsAnyAdmin = true;

    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    expect(screen.queryByText('Site Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Studios')).not.toBeInTheDocument();
    expect(screen.queryByText('Organizations')).not.toBeInTheDocument();
  });

  it('should show the Competitions section header with count', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    expect(screen.getByText('Competitions (0)')).toBeInTheDocument();
  });

  it('should show empty state when no competitions exist for site admin', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    expect(screen.getByText('No competitions')).toBeInTheDocument();
    expect(screen.getByText('Create your first competition to get started.')).toBeInTheDocument();
  });

  it('should show different empty message for competition-only admins', async () => {
    (globalThis as any).__mockIsAdmin = false;
    (globalThis as any).__mockIsAnyAdmin = true;

    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    expect(screen.getByText('You have not been assigned to any competitions yet.')).toBeInTheDocument();
  });

  it('should show "+ New Competition" link for site admins when competitions exist', async () => {
    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    const newCompLink = screen.getByRole('link', { name: /\+ New Competition/i });
    expect(newCompLink).toBeInTheDocument();
    expect(newCompLink).toHaveAttribute('href', '/competitions');
  });

  it('should NOT show "+ New Competition" link for competition-only admins', async () => {
    (globalThis as any).__mockIsAdmin = false;
    (globalThis as any).__mockIsAnyAdmin = true;

    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Admin Dashboard');
    expect(screen.queryByRole('link', { name: /\+ New Competition/i })).not.toBeInTheDocument();
  });

  it('should display competition names when data loads', async () => {
    mockGetAllCompetitions.mockResolvedValue({
      data: [
        { id: 1, name: 'Spring Championship', type: 'NDCA', date: '2026-03-15' },
        { id: 2, name: 'Fall Classic', type: 'USA_DANCE', date: '2026-10-20' },
      ],
    });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Spring Championship')).toBeInTheDocument();
    expect(screen.getByText('Fall Classic')).toBeInTheDocument();
  });

  it('should display the correct competition count in header', async () => {
    mockGetAllCompetitions.mockResolvedValue({
      data: [
        { id: 1, name: 'Spring Championship', type: 'NDCA', date: '2026-03-15' },
        { id: 2, name: 'Fall Classic', type: 'USA_DANCE', date: '2026-10-20' },
      ],
    });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Spring Championship');
    expect(screen.getByText('Competitions (2)')).toBeInTheDocument();
  });

  it('should link each competition row to its detail page', async () => {
    mockGetAllCompetitions.mockResolvedValue({
      data: [
        { id: 42, name: 'Grand Prix', type: 'NDCA', date: '2026-05-01' },
      ],
    });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Grand Prix');
    const manageLink = screen.getByRole('link', { name: /Grand Prix/i });
    expect(manageLink).toHaveAttribute('href', '/competitions/42');
  });

  it('should show competition location when provided', async () => {
    mockGetAllCompetitions.mockResolvedValue({
      data: [
        { id: 1, name: 'Winter Ball', type: 'STUDIO', date: '2026-12-01', location: 'Chicago, IL' },
      ],
    });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Winter Ball');
    expect(screen.getByText('Chicago, IL')).toBeInTheDocument();
  });

  it('should sort competitions by date descending', async () => {
    mockGetAllCompetitions.mockResolvedValue({
      data: [
        { id: 1, name: 'Early Event', type: 'NDCA', date: '2026-01-01' },
        { id: 2, name: 'Late Event', type: 'NDCA', date: '2026-12-01' },
        { id: 3, name: 'Mid Event', type: 'NDCA', date: '2026-06-15' },
      ],
    });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    await screen.findByText('Late Event');

    const competitionLinks = screen.getAllByRole('link', { name: /Event/i });
    const names = competitionLinks.map(link => link.textContent?.trim()).filter(Boolean);
    // Most recent first
    expect(names[0]).toContain('Late Event');
    expect(names[names.length - 1]).toContain('Early Event');
  });

  it('should show Access Denied when user is not any admin', async () => {
    (globalThis as any).__mockIsAdmin = false;
    (globalThis as any).__mockIsAnyAdmin = false;

    mockGetAllCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <AdminDashboardPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You must be an admin to access this page.')).toBeInTheDocument();
  });
});
