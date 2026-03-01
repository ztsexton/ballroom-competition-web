import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Competition } from '../types';

// Mock the auth context with dynamic values
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: (globalThis as Record<string, unknown>).__mockIsAdmin ?? true,
    isAnyAdmin: (globalThis as Record<string, unknown>).__mockIsAnyAdmin ?? true,
    loading: false,
  }),
}));

// Mock the competition context with dynamic active competition
const getMockCompetition = (): Competition | null => {
  return (globalThis as Record<string, unknown>).__mockActiveCompetition as Competition | null || null;
};

vi.mock('../context/CompetitionContext', () => ({
  useCompetition: () => ({
    activeCompetition: getMockCompetition(),
    setActiveCompetition: vi.fn(),
    competitions: [],
    loading: false,
    refreshCompetitions: vi.fn(() => Promise.resolve()),
  }),
}));

// Mock the API client
vi.mock('../api/client', () => ({
  competitionsApi: {
    update: vi.fn(() => Promise.resolve({ data: getMockCompetition() })),
    getAdmins: vi.fn(() => Promise.resolve({ data: [] })),
    addAdmin: vi.fn(() => Promise.resolve({ data: { userUid: 'new-uid', email: 'new@test.com' } })),
    removeAdmin: vi.fn(() => Promise.resolve({ data: {} })),
  },
  organizationsApi: {
    getAll: vi.fn(() => Promise.resolve({ data: [] })),
    getById: vi.fn(() => Promise.resolve({ data: { id: 1, name: 'Test Org' } })),
    create: vi.fn(() => Promise.resolve({ data: { id: 2, name: 'New Org' } })),
  },
  settingsApi: {
    get: vi.fn(() => Promise.resolve({ data: { maxJudgeHoursWithoutBreak: 4.5 } })),
    update: vi.fn(() => Promise.resolve({ data: {} })),
  },
  schedulesApi: {
    getJudgeSchedule: vi.fn(() => Promise.resolve({ data: { entries: [], maxMinutesWithoutBreak: 270 } })),
  },
}));

// Import component after all mocks are set up
import CompetitionSettingsPage from '../pages/competitions/CompetitionSettingsPage';

// Router wrapper with v7 future flags to suppress deprecation warnings
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

const mockCompetition: Competition = {
  id: 1,
  name: 'Spring Ballroom Classic',
  type: 'NDCA',
  date: '2026-06-15',
  location: 'New York, NY',
  description: 'A great competition',
  levels: ['Newcomer', 'Bronze', 'Silver', 'Gold'],
  registrationOpen: true,
  resultsPublic: true,
  publiclyVisible: true,
  heatListsPublished: false,
  createdAt: '2026-01-01',
};

describe('CompetitionSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).__mockActiveCompetition = null;
    (globalThis as Record<string, unknown>).__mockIsAdmin = true;
    (globalThis as Record<string, unknown>).__mockIsAnyAdmin = true;
  });

  it('should show loading skeleton when no active competition', () => {
    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // When no activeCompetition, the component renders Skeleton cards
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should render competition name in the form when loaded', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // The Competition Name label should be visible
    expect(await screen.findByText('Competition Name')).toBeInTheDocument();

    // The input should have the competition name as its value
    const nameInput = screen.getByDisplayValue('Spring Ballroom Classic');
    expect(nameInput).toBeInTheDocument();
  });

  it('should show competition admin section', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // Click the Access tab to reveal the Competition Admins section
    fireEvent.click(await screen.findByRole('button', { name: 'Access' }));

    // The Competition Admins section title should be present
    expect(await screen.findByText('Competition Admins')).toBeInTheDocument();
  });

  it('should show registration and public visibility toggles', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // Click the Access tab to reveal Visibility & Access section
    fireEvent.click(await screen.findByRole('button', { name: 'Access' }));

    // Wait for content to load
    await screen.findByText('Visibility & Access');

    // Registration toggle label
    expect(screen.getByText('Participant Registration Open')).toBeInTheDocument();

    // Results public toggle label
    expect(screen.getByText('Public Results On')).toBeInTheDocument();

    // Public visibility toggle label
    expect(screen.getByText('Public Visibility On')).toBeInTheDocument();
  });

  it('should show level configuration in Rules & Scoring section', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // Click the Rules tab to reveal Rules & Scoring section
    fireEvent.click(await screen.findByRole('button', { name: 'Rules' }));

    // Rules & Scoring section should be present
    expect(await screen.findByText('Rules & Scoring')).toBeInTheDocument();

    // Competition Levels label
    expect(screen.getByText('Competition Levels')).toBeInTheDocument();

    // Levels from the mock competition should be displayed
    expect(screen.getByText('Newcomer')).toBeInTheDocument();
    expect(screen.getByText('Bronze')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('should show general section with date and location fields', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // Wait for the General section to render (tab button + section heading both say "General")
    const generals = await screen.findAllByText('General');
    expect(generals.length).toBeGreaterThanOrEqual(2);

    // Date and Location labels
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();

    // Location input should have the value from the mock competition
    expect(screen.getByDisplayValue('New York, NY')).toBeInTheDocument();
  });

  it('should show Judges tab with Judge Breaks section', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // Click the Judges tab
    fireEvent.click(await screen.findByRole('button', { name: 'Judges' }));

    // Judge Breaks section should be present
    expect(await screen.findByText('Judge Breaks')).toBeInTheDocument();
    expect(screen.getByText('Max Judge Hours Without Break')).toBeInTheDocument();
  });

  it('should show site default value in Judge Breaks placeholder', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // Click the Judges tab
    fireEvent.click(await screen.findByRole('button', { name: 'Judges' }));

    // Wait for the section to render
    await screen.findByText('Max Judge Hours Without Break');

    // The input should have the site default in the placeholder (4.5 from mock)
    const input = screen.getByPlaceholderText('4.5 (site default)');
    expect(input).toBeInTheDocument();
  });

  it('should show site default in help text', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Judges' }));

    // Help text should reference the actual site default
    expect(await screen.findByText(/Override the site default \(4\.5h\)/)).toBeInTheDocument();
  });

  it('should show Judge Schedule section in Judges tab', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Judges' }));

    expect(await screen.findByText('Judge Schedule')).toBeInTheDocument();
  });

  it('should not show Judge Breaks in Events tab', async () => {
    (globalThis as Record<string, unknown>).__mockActiveCompetition = mockCompetition;

    render(
      <RouterWrapper>
        <CompetitionSettingsPage />
      </RouterWrapper>
    );

    // Click the Events tab
    fireEvent.click(await screen.findByRole('button', { name: 'Events' }));

    // Wait for Events tab content to load
    await screen.findByText('Dance Order');

    // Judge Breaks should NOT be in the Events tab
    expect(screen.queryByText('Judge Breaks')).not.toBeInTheDocument();
  });
});
