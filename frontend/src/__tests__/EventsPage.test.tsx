import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Create mock fns BEFORE vi.mock
const mockGetAllEvents = vi.fn();
const mockDeleteEvent = vi.fn();

vi.mock('../api/client', () => ({
  eventsApi: {
    getAll: (...args: unknown[]) => mockGetAllEvents(...args),
    delete: (...args: unknown[]) => mockDeleteEvent(...args),
  },
}));

const getMockCompetition = () => (globalThis as any).__mockActiveCompetition || null;

vi.mock('../context/CompetitionContext', () => ({
  useCompetition: () => ({
    activeCompetition: getMockCompetition(),
    competitions: (globalThis as any).__mockCompetitions || [],
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

// Import component AFTER mocks
import { EventsPage } from '../pages/events';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

const makeEvent = (overrides: Partial<{
  id: number;
  name: string;
  style: string;
  designation: string;
  syllabusType: string;
  level: string;
  dances: string[];
  heats: Array<{ round: string; bibs: number[]; judges: number[]; scores: Record<string, unknown> }>;
}> = {}) => ({
  id: 1,
  name: 'Test Event',
  style: 'Smooth',
  designation: 'Amateur',
  syllabusType: 'Bronze',
  level: 'Open',
  dances: ['Waltz', 'Tango'],
  heats: [{ round: 'final', bibs: [1, 2], judges: [1], scores: {} }],
  ...overrides,
});

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockActiveCompetition = null;
    (globalThis as any).__mockCompetitions = [];
    (globalThis as any).__mockIsAdmin = true;
  });

  it('should show loading skeleton while loading', () => {
    // With no competition set, the component short-circuits to loading=false quickly.
    // To capture the skeleton we set a competition so it calls loadEvents which pends.
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };
    mockGetAllEvents.mockReturnValue(new Promise(() => {})); // never resolves

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show "No Active Competition" message when no competition is selected', async () => {
    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No Active Competition')).toBeInTheDocument();
    expect(screen.getByText(/Please select a competition to manage events/)).toBeInTheDocument();
  });

  it('should show "Manage Events" heading when a competition is active', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllEvents.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/Manage Events/)).toBeInTheDocument();
  });

  it('should show "Create New Event" link when competition is active', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllEvents.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    expect(await screen.findByRole('link', { name: 'Create New Event' })).toBeInTheDocument();
  });

  it('should show empty state when no events exist', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllEvents.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No events created yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first event to get started!')).toBeInTheDocument();
  });

  it('should render event list grouped by style sections when events exist', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    const event = makeEvent({ id: 42, name: 'Smooth Bronze Waltz', style: 'Smooth' });
    mockGetAllEvents.mockResolvedValue({ data: { 42: event } });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    // Event name appears in the table
    expect(await screen.findByText('Smooth Bronze Waltz')).toBeInTheDocument();
    // Event ID is rendered
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  it('should show action links for each event (View, Entries, Edit, Score, Results)', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    const event = makeEvent({ id: 7, name: 'Latin Silver', style: 'Latin' });
    mockGetAllEvents.mockResolvedValue({ data: { 7: event } });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    await screen.findByText('Latin Silver');

    expect(screen.getByRole('link', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entries' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Score' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('should show style section jump nav when events exist', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    const event = makeEvent({ id: 1, name: 'Rhythm Gold', style: 'Rhythm' });
    mockGetAllEvents.mockResolvedValue({ data: { 1: event } });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    await screen.findByText('Rhythm Gold');

    // Jump nav links for each style section should be present
    expect(screen.getAllByText(/Smooth \(\d+\)/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Rhythm \(\d+\)/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Latin \(\d+\)/)[0]).toBeInTheDocument();
  });

  it('should show Quick Stats section when events exist', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    const event = makeEvent({ id: 1, name: 'Smooth Waltz', style: 'Smooth' });
    mockGetAllEvents.mockResolvedValue({ data: { 1: event } });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    await screen.findByText('Smooth Waltz');

    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
    expect(screen.getByText(/Total Events:/)).toBeInTheDocument();
  });

  it('should display competitor count per event row', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    const event = makeEvent({
      id: 5,
      name: 'Standard Silver',
      style: 'Standard',
      heats: [{ round: 'final', bibs: [10, 11, 12], judges: [1], scores: {} }],
    });
    mockGetAllEvents.mockResolvedValue({ data: { 5: event } });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    await screen.findByText('Standard Silver');

    // 3 unique bibs → "3 couples"
    expect(screen.getByText('3 couples')).toBeInTheDocument();
  });

  it('should show "Access Denied" when user is not an admin and not inside hub', async () => {
    (globalThis as any).__mockIsAdmin = false;
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllEvents.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You must be an admin to manage events.')).toBeInTheDocument();
  });

  it('should show table column headers when events exist', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    const event = makeEvent({ id: 3, name: 'Country Two-Step', style: 'Country' });
    mockGetAllEvents.mockResolvedValue({ data: { 3: event } });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    await screen.findByText('Country Two-Step');

    expect(screen.getAllByText('Event #').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Name').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Details').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Rounds').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Competitors').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Actions').length).toBeGreaterThanOrEqual(1);
  });

  it('should show "Other" section for events with unrecognised style', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    const event = makeEvent({ id: 9, name: 'Mystery Dance', style: 'Fusion' });
    mockGetAllEvents.mockResolvedValue({ data: { 9: event } });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    await screen.findByText('Mystery Dance');

    // The "Other" section header should appear
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('should show "no <style> events" placeholder for empty style sections', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    const event = makeEvent({ id: 1, name: 'Smooth Waltz', style: 'Smooth' });
    mockGetAllEvents.mockResolvedValue({ data: { 1: event } });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    await screen.findByText('Smooth Waltz');

    // Sections with no events show italic placeholder text
    expect(screen.getByText('No standard events')).toBeInTheDocument();
    expect(screen.getByText('No rhythm events')).toBeInTheDocument();
    expect(screen.getByText('No latin events')).toBeInTheDocument();
  });

  it('should include the competition name in the heading', async () => {
    (globalThis as any).__mockActiveCompetition = {
      id: 1, name: 'Spring Classic', type: 'UNAFFILIATED', date: '2026-06-01', createdAt: '2026-01-01',
    };

    mockGetAllEvents.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <EventsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Manage Events - Spring Classic')).toBeInTheDocument();
  });
});
