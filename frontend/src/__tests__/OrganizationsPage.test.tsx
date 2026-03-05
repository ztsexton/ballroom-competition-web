import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const mockGetAll = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../api/client', () => ({
  organizationsApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: (globalThis as any).__mockIsAdmin ?? true,
    isAnyAdmin: (globalThis as any).__mockIsAnyAdmin ?? true,
    loading: (globalThis as any).__mockAuthLoading ?? false,
  }),
}));

vi.mock('../constants/ageCategories', () => ({
  AGE_CATEGORY_PRESETS: {
    ndca: [{ name: 'Adult', minAge: 19, maxAge: 34 }],
    usadance: [{ name: 'Adult', minAge: 19 }],
    wdc: [],
    wdsf: [],
  },
}));

// Import component AFTER mocks
import OrganizationsPage from '../pages/admin/OrganizationsPage';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('OrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockIsAdmin = true;
    (globalThis as any).__mockIsAnyAdmin = true;
    (globalThis as any).__mockAuthLoading = false;
  });

  it('should render the Organizations heading after loading', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Organizations')).toBeInTheDocument();
  });

  it('should show loading skeleton while auth or data is loading', () => {
    (globalThis as any).__mockAuthLoading = true;
    mockGetAll.mockReturnValue(new Promise(() => {}));

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show Access Denied when user is not an admin', async () => {
    (globalThis as any).__mockIsAdmin = false;
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You must be an admin to manage organizations.')).toBeInTheDocument();
  });

  it('should show empty state when there are no organizations', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('No organizations yet')).toBeInTheDocument();
    expect(screen.getByText('Create an organization to define rule presets and default settings for your competitions.')).toBeInTheDocument();
  });

  it('should display organization names in the list', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'NDCA Region 1', rulePresetKey: 'ndca', settings: {} },
        { id: 2, name: 'Studio Open', rulePresetKey: 'custom', settings: {} },
      ],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('NDCA Region 1')).toBeInTheDocument();
    expect(screen.getByText('Studio Open')).toBeInTheDocument();
  });

  it('should display the preset badge for each organization', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Org One', rulePresetKey: 'ndca', settings: {} },
        { id: 2, name: 'Org Two', rulePresetKey: 'usadance', settings: {} },
      ],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org One');
    expect(screen.getByText('NDCA')).toBeInTheDocument();
    expect(screen.getByText('USA Dance')).toBeInTheDocument();
  });

  it('should display organization settings when present', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Test Org',
          rulePresetKey: 'ndca',
          settings: {
            defaultLevels: ['Bronze', 'Silver'],
            defaultScoringType: 'skating',
            defaultMaxCouplesPerHeat: 7,
            ageCategories: [{ name: 'Adult', minAge: 19, maxAge: 34 }],
          },
        },
      ],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Test Org');
    expect(screen.getByText('Levels: Bronze, Silver')).toBeInTheDocument();
    expect(screen.getByText('Scoring: skating')).toBeInTheDocument();
    expect(screen.getByText('Max couples/heat: 7')).toBeInTheDocument();
    expect(screen.getByText('Age categories: Adult')).toBeInTheDocument();
  });

  it('should show the + New Organization button', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    expect(screen.getByRole('button', { name: '+ New Organization' })).toBeInTheDocument();
  });

  it('should show the create form when + New Organization is clicked', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    fireEvent.click(screen.getByRole('button', { name: '+ New Organization' }));

    expect(screen.getByText('Create New Organization')).toBeInTheDocument();
    expect(screen.getByLabelText('Organization Name *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Organization' })).toBeInTheDocument();
  });

  it('should show Cancel buttons when form is open', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    fireEvent.click(screen.getByRole('button', { name: '+ New Organization' }));

    // There are two Cancel buttons: one in the header and one inside the form
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2);
  });

  it('should display all rule preset buttons in the create form', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    fireEvent.click(screen.getByRole('button', { name: '+ New Organization' }));

    expect(screen.getByRole('button', { name: 'NDCA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USA Dance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WDC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WDSF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
  });

  it('should show the custom preset description by default in the form', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    fireEvent.click(screen.getByRole('button', { name: '+ New Organization' }));

    expect(screen.getByText('Start with a blank slate and configure your own rules.')).toBeInTheDocument();
  });

  it('should show NDCA preset description when NDCA button is selected', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    fireEvent.click(screen.getByRole('button', { name: '+ New Organization' }));
    fireEvent.click(screen.getByRole('button', { name: 'NDCA' }));

    expect(screen.getByText('NDCA defaults: Bronze through Championship levels, standard scoring, 7 couples/heat.')).toBeInTheDocument();
  });

  it('should call organizationsApi.create and reload when form is submitted', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ data: { id: 10, name: 'New Org', rulePresetKey: 'custom', settings: {} } });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    fireEvent.click(screen.getByRole('button', { name: '+ New Organization' }));

    fireEvent.change(screen.getByLabelText('Organization Name *'), {
      target: { value: 'New Org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Organization' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'New Org',
        rulePresetKey: 'custom',
        settings: {},
      });
    });
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  });

  it('should hide the create form after successful submission', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ data: { id: 10, name: 'New Org', rulePresetKey: 'custom', settings: {} } });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    fireEvent.click(screen.getByRole('button', { name: '+ New Organization' }));

    fireEvent.change(screen.getByLabelText('Organization Name *'), {
      target: { value: 'New Org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Organization' }));

    await waitFor(() => {
      expect(screen.queryByText('Create New Organization')).not.toBeInTheDocument();
    });
  });

  it('should show an error message when create fails', async () => {
    mockGetAll.mockResolvedValue({ data: [] });
    mockCreate.mockRejectedValue(new Error('Network Error'));

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Organizations');
    fireEvent.click(screen.getByRole('button', { name: '+ New Organization' }));

    fireEvent.change(screen.getByLabelText('Organization Name *'), {
      target: { value: 'Bad Org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Organization' }));

    expect(await screen.findByText('Failed to create organization')).toBeInTheDocument();
  });

  it('should render a Delete button for each organization', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Org Alpha', rulePresetKey: 'ndca', settings: {} },
        { id: 2, name: 'Org Beta', rulePresetKey: 'custom', settings: {} },
      ],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org Alpha');
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
  });

  it('should call organizationsApi.delete and reload when delete is confirmed', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 5, name: 'To Delete', rulePresetKey: 'custom', settings: {} }],
    });
    mockDelete.mockResolvedValue({});

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('To Delete');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // ConfirmDialog opens — find the dialog and click its Delete button
    const dialog = await screen.findByRole('alertdialog');
    const dialogDeleteBtn = dialog.querySelector('button:last-child')!;
    fireEvent.click(dialogDeleteBtn);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(5);
    });
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  });

  it('should not call organizationsApi.delete when delete is cancelled', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 5, name: 'Stay', rulePresetKey: 'custom', settings: {} }],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Stay');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // ConfirmDialog opens — click Cancel
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should render Edit Age Categories button for each organization', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'Org One', rulePresetKey: 'ndca', settings: {} }],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org One');
    expect(screen.getByRole('button', { name: 'Edit Age Categories' })).toBeInTheDocument();
  });

  it('should show the age categories editor when Edit Age Categories is clicked', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'Org One', rulePresetKey: 'ndca', settings: {} }],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org One');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age Categories' }));

    expect(screen.getByText('Age Categories')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('should show empty age categories message when org has no age categories configured', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'Org One', rulePresetKey: 'custom', settings: {} }],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org One');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age Categories' }));

    expect(screen.getByText('No age categories configured')).toBeInTheDocument();
  });

  it('should show existing age categories when editing an org with age categories', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Org One',
          rulePresetKey: 'ndca',
          settings: { ageCategories: [{ name: 'Adult', minAge: 19, maxAge: 34 }] },
        },
      ],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org One');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age Categories' }));

    expect(screen.getByDisplayValue('Adult')).toBeInTheDocument();
  });

  it('should call organizationsApi.update and reload when age categories are saved', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Org One',
          rulePresetKey: 'ndca',
          settings: { ageCategories: [{ name: 'Adult', minAge: 19, maxAge: 34 }] },
        },
      ],
    });
    mockUpdate.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org One');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age Categories' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(1, {
        settings: { ageCategories: [{ name: 'Adult', minAge: 19, maxAge: 34 }] },
      });
    });
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  });

  it('should close the age categories editor after saving', async () => {
    mockGetAll.mockResolvedValue({
      data: [
        { id: 1, name: 'Org One', rulePresetKey: 'custom', settings: {} },
      ],
    });
    mockUpdate.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org One');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age Categories' }));

    expect(screen.getByText('Age Categories')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByText('Age Categories')).not.toBeInTheDocument();
    });
  });

  it('should show a Reset to Defaults button for presets that have age category presets', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'NDCA Org', rulePresetKey: 'ndca', settings: {} }],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('NDCA Org');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age Categories' }));

    expect(screen.getByRole('button', { name: 'Reset to NDCA Defaults' })).toBeInTheDocument();
  });

  it('should not show Reset to Defaults button for custom preset', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'Custom Org', rulePresetKey: 'custom', settings: {} }],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Custom Org');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age Categories' }));

    expect(screen.queryByRole('button', { name: /Reset to/i })).not.toBeInTheDocument();
  });

  it('should allow adding a new age category row in the editor', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 1, name: 'Org One', rulePresetKey: 'custom', settings: {} }],
    });

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org One');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Age Categories' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

    expect(screen.getAllByPlaceholderText('Name')).toHaveLength(1);
  });

  it('should call showToast with error when delete fails', async () => {
    mockGetAll.mockResolvedValue({
      data: [{ id: 5, name: 'Org Fail', rulePresetKey: 'custom', settings: {} }],
    });
    mockDelete.mockRejectedValue(new Error('Server Error'));

    render(
      <RouterWrapper>
        <OrganizationsPage />
      </RouterWrapper>
    );

    await screen.findByText('Org Fail');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // ConfirmDialog opens — find the dialog and click its Delete button
    const dialog = await screen.findByRole('alertdialog');
    const dialogDeleteBtn = dialog.querySelector('button:last-child')!;
    fireEvent.click(dialogDeleteBtn);

    // Delete was attempted
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(5);
    });
  });
});
