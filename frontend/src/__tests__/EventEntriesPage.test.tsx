import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Create mock fns BEFORE vi.mock
const mockGetById = vi.fn();
const mockGetEntries = vi.fn();
const mockAddEntry = vi.fn();
const mockRemoveEntry = vi.fn();
const mockGetAllCouples = vi.fn();

vi.mock('../api/client', () => ({
  eventsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getEntries: (...args: unknown[]) => mockGetEntries(...args),
    addEntry: (...args: unknown[]) => mockAddEntry(...args),
    removeEntry: (...args: unknown[]) => mockRemoveEntry(...args),
  },
  couplesApi: {
    getAll: (...args: unknown[]) => mockGetAllCouples(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '42' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

// Import component AFTER mocks
import EventEntriesPage from '../pages/events/EventEntriesPage';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

const makeEvent = (overrides = {}) => ({
  id: 42,
  name: 'Waltz Open',
  competitionId: 1,
  designation: 'Open',
  syllabusType: null,
  level: 'Bronze',
  style: 'Smooth',
  dances: ['Waltz'],
  scoringType: 'standard',
  heats: [{ id: 1 }, { id: 2 }],
  ...overrides,
});

const makeCouple = (bib: number, leader: string, follower: string, competitionId = 1) => ({
  bib,
  leaderId: bib * 10,
  followerId: bib * 10 + 1,
  leaderName: leader,
  followerName: follower,
  competitionId,
});

describe('EventEntriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton while data is loading', () => {
    // Return a promise that never resolves so we stay in loading state
    mockGetById.mockReturnValue(new Promise(() => {}));
    mockGetEntries.mockReturnValue(new Promise(() => {}));

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show "Event Not Found" when event API returns null', async () => {
    mockGetById.mockResolvedValue({ data: null });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Event Not Found')).toBeInTheDocument();
  });

  it('should display event name and summary info after loading', async () => {
    const event = makeEvent();
    mockGetById.mockResolvedValue({ data: event });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Event #42: Waltz Open')).toBeInTheDocument();
    // Summary line: "0 couples entered • 2 rounds • Standard scoring"
    expect(screen.getByText(/0 couples entered/)).toBeInTheDocument();
    expect(screen.getByText(/2 rounds/)).toBeInTheDocument();
    expect(screen.getByText(/Standard scoring/)).toBeInTheDocument();
  });

  it('should display event details (designation, level, style, dances)', async () => {
    const event = makeEvent();
    mockGetById.mockResolvedValue({ data: event });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    // details line: "Open • Bronze • Smooth • Waltz"
    await screen.findByText('Event #42: Waltz Open');
    expect(screen.getByText(/Open.*Bronze.*Smooth.*Waltz/)).toBeInTheDocument();
  });

  it('should show "No couples entered yet" when entries list is empty', async () => {
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No couples entered yet.')).toBeInTheDocument();
  });

  it('should render entered couples in the table', async () => {
    const event = makeEvent();
    const entries = [
      makeCouple(101, 'Alice Smith', 'Bob Jones'),
      makeCouple(202, 'Carol White', 'Dave Brown'),
    ];

    mockGetById.mockResolvedValue({ data: event });
    mockGetEntries.mockResolvedValue({ data: entries });
    mockGetAllCouples.mockResolvedValue({ data: entries });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('#101')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('#202')).toBeInTheDocument();
    expect(screen.getByText('Carol White')).toBeInTheDocument();
    expect(screen.getByText('Dave Brown')).toBeInTheDocument();
  });

  it('should show table headers when entries exist', async () => {
    const entry = makeCouple(101, 'Alice Smith', 'Bob Jones');
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [entry] });
    mockGetAllCouples.mockResolvedValue({ data: [entry] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    await screen.findByText('#101');
    expect(screen.getByText('Bib #')).toBeInTheDocument();
    expect(screen.getByText('Leader')).toBeInTheDocument();
    expect(screen.getByText('Follower')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should show Remove buttons for each entered couple', async () => {
    const entries = [
      makeCouple(101, 'Alice Smith', 'Bob Jones'),
      makeCouple(202, 'Carol White', 'Dave Brown'),
    ];
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: entries });
    mockGetAllCouples.mockResolvedValue({ data: entries });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    await screen.findByText('#101');
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons).toHaveLength(2);
  });

  it('should show "All couples are already entered" when all couples are in the event', async () => {
    const couple = makeCouple(101, 'Alice Smith', 'Bob Jones');
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [couple] });
    mockGetAllCouples.mockResolvedValue({ data: [couple] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('All couples are already entered in this event.')).toBeInTheDocument();
  });

  it('should show a couple select dropdown with available couples', async () => {
    const enteredCouple = makeCouple(101, 'Alice Smith', 'Bob Jones');
    const availableCouple = makeCouple(202, 'Carol White', 'Dave Brown');

    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [enteredCouple] });
    mockGetAllCouples.mockResolvedValue({ data: [enteredCouple, availableCouple] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    await screen.findByText('#101');
    // The select dropdown should contain the available couple but not the entered one
    const option = screen.getByRole('option', { name: /#202 - Carol White & Dave Brown/ });
    expect(option).toBeInTheDocument();
  });

  it('should not include already-entered couples in the Add Couple dropdown', async () => {
    const enteredCouple = makeCouple(101, 'Alice Smith', 'Bob Jones');
    const availableCouple = makeCouple(202, 'Carol White', 'Dave Brown');

    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [enteredCouple] });
    mockGetAllCouples.mockResolvedValue({ data: [enteredCouple, availableCouple] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    await screen.findByText('#101');
    // Bib 101 should not appear in the dropdown options
    const options = screen.queryAllByRole('option', { name: /#101/ });
    expect(options).toHaveLength(0);
  });

  it('should call removeEntry and reload data when Remove is clicked', async () => {
    const entry = makeCouple(101, 'Alice Smith', 'Bob Jones');
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [entry] });
    mockGetAllCouples.mockResolvedValue({ data: [entry] });
    mockRemoveEntry.mockResolvedValue({});

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    const removeButton = await screen.findByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockRemoveEntry).toHaveBeenCalledWith(42, 101);
    });
  });

  it('should call addEntry when a couple is selected and Add is clicked', async () => {
    const availableCouple = makeCouple(202, 'Carol White', 'Dave Brown');
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [availableCouple] });
    mockAddEntry.mockResolvedValue({ data: makeEvent() });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    // Wait for loading to finish and select to appear
    await screen.findByRole('option', { name: /#202 - Carol White & Dave Brown/ });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '202' } });

    const addButton = screen.getByRole('button', { name: /^add$/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockAddEntry).toHaveBeenCalledWith(42, 202);
    });
  });

  it('should disable the Add button when no couple is selected', async () => {
    const availableCouple = makeCouple(202, 'Carol White', 'Dave Brown');
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [availableCouple] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    await screen.findByRole('option', { name: /#202 - Carol White & Dave Brown/ });
    const addButton = screen.getByRole('button', { name: /^add$/i });
    expect(addButton).toBeDisabled();
  });

  it('should show "Event Not Found" when loading fails', async () => {
    // When the API rejects, event stays null, so the component shows "Event Not Found"
    mockGetById.mockRejectedValue(new Error('Network error'));
    mockGetEntries.mockRejectedValue(new Error('Network error'));

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Event Not Found')).toBeInTheDocument();
  });

  it('should show an error message when removeEntry fails', async () => {
    const entry = makeCouple(101, 'Alice Smith', 'Bob Jones');
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [entry] });
    mockGetAllCouples.mockResolvedValue({ data: [entry] });
    mockRemoveEntry.mockRejectedValue(new Error('Server error'));

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    const removeButton = await screen.findByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);

    expect(await screen.findByText('Failed to remove couple')).toBeInTheDocument();
  });

  it('should show Proficiency scoring in the summary when scoringType is proficiency', async () => {
    const event = makeEvent({ scoringType: 'proficiency' });
    mockGetById.mockResolvedValue({ data: event });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/Proficiency scoring/)).toBeInTheDocument();
  });

  it('should show "1 couple entered" (singular) when exactly one couple is entered', async () => {
    const entry = makeCouple(101, 'Alice Smith', 'Bob Jones');
    const event = makeEvent({ heats: [{ id: 1 }] });
    mockGetById.mockResolvedValue({ data: event });
    mockGetEntries.mockResolvedValue({ data: [entry] });
    mockGetAllCouples.mockResolvedValue({ data: [entry] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/1 couple entered/)).toBeInTheDocument();
    // Should NOT say "couples" (plural)
    expect(screen.queryByText(/1 couples entered/)).not.toBeInTheDocument();
  });

  it('should show "1 round" (singular) when event has exactly one round', async () => {
    const event = makeEvent({ heats: [{ id: 1 }] });
    mockGetById.mockResolvedValue({ data: event });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/1 round[^s]/)).toBeInTheDocument();
  });

  it('should show "Entered Couples (N)" section heading', async () => {
    const entries = [
      makeCouple(101, 'Alice Smith', 'Bob Jones'),
      makeCouple(202, 'Carol White', 'Dave Brown'),
    ];
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: entries });
    mockGetAllCouples.mockResolvedValue({ data: entries });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Entered Couples (2)')).toBeInTheDocument();
  });

  it('should show "Add Couple" section heading', async () => {
    mockGetById.mockResolvedValue({ data: makeEvent() });
    mockGetEntries.mockResolvedValue({ data: [] });
    mockGetAllCouples.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <EventEntriesPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Add Couple')).toBeInTheDocument();
  });
});
