import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/client', () => ({
  judgeProfilesApi: {
    getAll: vi.fn(() => Promise.resolve({ data: [] })),
    create: vi.fn(() => Promise.resolve({ data: { id: 1, firstName: 'New', lastName: 'Judge', certifications: {} } })),
    update: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

import JudgeProfilesPage from '../pages/admin/JudgeProfilesPage';
import { judgeProfilesApi } from '../api/client';

describe('JudgeProfilesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page title', async () => {
    render(
      <MemoryRouter>
        <JudgeProfilesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Judge Management')).toBeInTheDocument();
  });

  it('should show empty state when no profiles', async () => {
    render(
      <MemoryRouter>
        <JudgeProfilesPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('No judge profiles yet')).toBeInTheDocument();
  });

  it('should display profiles when loaded', async () => {
    (judgeProfilesApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', certifications: {} },
        { id: 2, firstName: 'Jane', lastName: 'Smith', certifications: { Smooth: ['Gold'] } },
      ],
    });

    render(
      <MemoryRouter>
        <JudgeProfilesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should show the add form fields', async () => {
    render(
      <MemoryRouter>
        <JudgeProfilesPage />
      </MemoryRouter>
    );
    await screen.findByText('Judge Management');
    expect(screen.getByPlaceholderText('First name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Last name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Optional')).toBeInTheDocument();
    expect(screen.getByText('Add Judge')).toBeInTheDocument();
  });

  it('should call create API when adding a profile', async () => {
    const user = userEvent.setup();
    // First call returns empty, second call after creation returns the new profile
    (judgeProfilesApi.getAll as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 1, firstName: 'New', lastName: 'Judge', certifications: {} }] });

    render(
      <MemoryRouter>
        <JudgeProfilesPage />
      </MemoryRouter>
    );
    await screen.findByText('Judge Management');

    await user.type(screen.getByPlaceholderText('First name'), 'New');
    await user.type(screen.getByPlaceholderText('Last name'), 'Judge');
    await user.click(screen.getByText('Add Judge'));

    await waitFor(() => {
      expect(judgeProfilesApi.create).toHaveBeenCalledWith({
        firstName: 'New',
        lastName: 'Judge',
        email: undefined,
        certifications: {},
      });
    });
  });

  it('should expand qualification matrix on click', async () => {
    const user = userEvent.setup();
    (judgeProfilesApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        { id: 1, firstName: 'John', lastName: 'Doe', certifications: {} },
      ],
    });

    render(
      <MemoryRouter>
        <JudgeProfilesPage />
      </MemoryRouter>
    );

    const qualBtn = await screen.findByText('Qualifications');
    await user.click(qualBtn);

    // Should show the styles
    expect(screen.getByText('Smooth')).toBeInTheDocument();
    expect(screen.getByText('Rhythm')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Latin')).toBeInTheDocument();

    // Should show certification levels
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('Novice')).toBeInTheDocument();
    expect(screen.getByText('Championship')).toBeInTheDocument();
  });
});
