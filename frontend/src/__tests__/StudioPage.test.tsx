import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock auth context with dynamic values via globalThis
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: (globalThis as any).__mockIsAdmin ?? true,
    isAnyAdmin: (globalThis as any).__mockIsAnyAdmin ?? true,
    loading: (globalThis as any).__mockAuthLoading ?? false,
  }),
}));

// Create mock fns BEFORE vi.mock
const mockGetAll = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('../api/client', () => ({
  studiosApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  mindbodyApi: {
    connect: (...args: unknown[]) => mockConnect(...args),
    disconnect: (...args: unknown[]) => mockDisconnect(...args),
  },
}));

// Import component AFTER mocks
import StudioPage from '../pages/admin/StudioPage';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('StudioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockIsAdmin = true;
    (globalThis as any).__mockIsAnyAdmin = true;
    (globalThis as any).__mockAuthLoading = false;
  });

  it('should show loading skeleton while auth or data is loading', () => {
    (globalThis as any).__mockAuthLoading = true;
    mockGetAll.mockReturnValue(new Promise(() => {}));

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show loading skeleton while studios data is loading', () => {
    mockGetAll.mockReturnValue(new Promise(() => {}));

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should render the Studios heading after data loads', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Studios')).toBeInTheDocument();
  });

  it('should render the Add a Studio form heading', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');
    expect(screen.getByText('Add a Studio')).toBeInTheDocument();
  });

  it('should render Studio Name and Contact Email form fields', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');
    expect(screen.getByLabelText(/Studio Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact Email/i)).toBeInTheDocument();
  });

  it('should render the Add Studio submit button', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');
    expect(screen.getByRole('button', { name: 'Add Studio' })).toBeInTheDocument();
  });

  it('should show empty state message when there are no studios', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No studios yet. Create one above.')).toBeInTheDocument();
  });

  it('should display studio names when studios exist', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Dance World', contactInfo: 'dance@world.com' },
        { id: 2, name: 'Ballet Academy', contactInfo: 'info@ballet.com' },
      ],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Dance World')).toBeInTheDocument();
    expect(screen.getByText('Ballet Academy')).toBeInTheDocument();
  });

  it('should display studio contact info when provided', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Dance World', contactInfo: 'dance@world.com' },
      ],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    expect(screen.getByText('dance@world.com')).toBeInTheDocument();
  });

  it('should show a Delete button for each studio', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Dance World', contactInfo: 'dance@world.com' },
        { id: 2, name: 'Ballet Academy', contactInfo: 'info@ballet.com' },
      ],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    expect(deleteButtons).toHaveLength(2);
  });

  it('should show a Connect MindBody button for studios without MindBody connected', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Dance World', contactInfo: 'dance@world.com' },
      ],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    expect(screen.getByRole('button', { name: 'Connect MindBody' })).toBeInTheDocument();
  });

  it('should show MindBody Connected badge for studios with mindbodySiteId', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Dance World', contactInfo: 'dance@world.com', mindbodySiteId: '-99' },
      ],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    expect(screen.getByText('MindBody Connected (Site: -99)')).toBeInTheDocument();
  });

  it('should show Disconnect button for studios with MindBody connected', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Dance World', contactInfo: 'dance@world.com', mindbodySiteId: '-99' },
      ],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('should show the MindBody connect form when Connect MindBody is clicked', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Dance World', contactInfo: 'dance@world.com' },
      ],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    fireEvent.click(screen.getByRole('button', { name: 'Connect MindBody' }));

    expect(screen.getByText('Connect to MindBody')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. -99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should hide the MindBody connect form when Cancel is clicked', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Dance World', contactInfo: 'dance@world.com' },
      ],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    fireEvent.click(screen.getByRole('button', { name: 'Connect MindBody' }));
    expect(screen.getByText('Connect to MindBody')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Connect to MindBody')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect MindBody' })).toBeInTheDocument();
  });

  it('should call studiosApi.create with correct data on form submission', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ data: { id: 3, name: 'New Studio', contactInfo: 'new@studio.com' } });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');

    fireEvent.change(screen.getByLabelText(/Studio Name/i), { target: { value: 'New Studio' } });
    fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'new@studio.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Studio' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ name: 'New Studio', contactInfo: 'new@studio.com' });
    });
  });

  it('should show success message after studio is added', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ data: { id: 3, name: 'New Studio', contactInfo: 'new@studio.com' } });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');

    fireEvent.change(screen.getByLabelText(/Studio Name/i), { target: { value: 'New Studio' } });
    fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'new@studio.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Studio' }));

    expect(await screen.findByText('Studio added successfully!')).toBeInTheDocument();
  });

  it('should clear form fields after successful studio creation', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ data: { id: 3, name: 'New Studio', contactInfo: 'new@studio.com' } });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');

    const nameInput = screen.getByLabelText(/Studio Name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/Contact Email/i) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'New Studio' } });
    fireEvent.change(emailInput, { target: { value: 'new@studio.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Studio' }));

    await screen.findByText('Studio added successfully!');
    expect(nameInput.value).toBe('');
    expect(emailInput.value).toBe('');
  });

  it('should show error message when studio creation fails', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    mockCreate.mockRejectedValue({ isAxiosError: false });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');

    fireEvent.change(screen.getByLabelText(/Studio Name/i), { target: { value: 'Fail Studio' } });
    fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'fail@studio.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Studio' }));

    expect(await screen.findByText('Failed to add studio')).toBeInTheDocument();
  });

  it('should call studiosApi.delete when Delete is confirmed', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'Dance World', contactInfo: 'dance@world.com' }],
    });
    mockDelete.mockResolvedValue({});

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // ConfirmDialog opens — click the confirm button (labeled "Confirm")
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(1);
    });
  });

  it('should NOT call studiosApi.delete when Delete is cancelled in confirm dialog', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'Dance World', contactInfo: 'dance@world.com' }],
    });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // ConfirmDialog opens — click Cancel
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should attempt delete and handle error when delete fails', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'Dance World', contactInfo: 'dance@world.com' }],
    });
    mockDelete.mockRejectedValue(new Error('Network error'));

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Dance World');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // ConfirmDialog opens — click confirm
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    // Delete was attempted
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(1);
    });
  });

  it('should show Access Denied when user is not an admin', async () => {
    (globalThis as any).__mockIsAdmin = false;
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You must be an admin to manage studios.')).toBeInTheDocument();
  });

  it('should show error when loading studios fails', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'));

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Failed to load studios')).toBeInTheDocument();
  });

  it('should reload studios after adding a new studio', async () => {
    mockGetAll
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 3, name: 'New Studio', contactInfo: 'new@studio.com' }] });
    mockCreate.mockResolvedValue({ data: { id: 3, name: 'New Studio', contactInfo: 'new@studio.com' } });

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');

    fireEvent.change(screen.getByLabelText(/Studio Name/i), { target: { value: 'New Studio' } });
    fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'new@studio.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Studio' }));

    expect(await screen.findByText('New Studio')).toBeInTheDocument();
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  });

  it('should show submitting state on the Add Studio button while creating', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    let resolveCreate: (value: unknown) => void;
    mockCreate.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));

    render(
      <RouterWrapper>
        <StudioPage />
      </RouterWrapper>
    );

    await screen.findByText('Studios');

    fireEvent.change(screen.getByLabelText(/Studio Name/i), { target: { value: 'New Studio' } });
    fireEvent.change(screen.getByLabelText(/Contact Email/i), { target: { value: 'new@studio.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Studio' }));

    expect(await screen.findByRole('button', { name: 'Adding...' })).toBeInTheDocument();

    resolveCreate!({ data: { id: 3, name: 'New Studio', contactInfo: 'new@studio.com' } });
    await screen.findByText('Studio added successfully!');
  });
});
