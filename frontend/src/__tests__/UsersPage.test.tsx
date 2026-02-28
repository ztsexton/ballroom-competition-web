import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock auth context with dynamic values via globalThis
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: (globalThis as any).__mockIsAdmin ?? true,
    isAnyAdmin: (globalThis as any).__mockIsAnyAdmin ?? true,
    loading: false,
  }),
}));

// Create mock fns BEFORE vi.mock
const mockGetAll = vi.fn();
const mockUpdateAdmin = vi.fn();

vi.mock('../api/client', () => ({
  usersApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    updateAdmin: (...args: unknown[]) => mockUpdateAdmin(...args),
  },
}));

// Import component AFTER mocks
import UsersPage from '../pages/admin/UsersPage';

// Router wrapper with v7 future flags to suppress deprecation warnings
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

const mockUsers = [
  {
    uid: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice Smith',
    photoURL: null,
    isAdmin: false,
    signInMethods: ['google'],
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-02-15T10:30:00Z',
  },
  {
    uid: 'user-2',
    email: 'bob@example.com',
    displayName: 'Bob Jones',
    photoURL: null,
    isAdmin: true,
    signInMethods: ['google'],
    createdAt: '2026-01-05T00:00:00Z',
    lastLoginAt: '2026-02-20T14:00:00Z',
  },
  {
    uid: 'user-primary',
    email: 'zsexton2011@gmail.com',
    displayName: 'Primary Admin',
    photoURL: null,
    isAdmin: true,
    signInMethods: ['google'],
    createdAt: '2025-06-01T00:00:00Z',
    lastLoginAt: '2026-02-28T08:00:00Z',
  },
];

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockIsAdmin = true;
    (globalThis as any).__mockIsAnyAdmin = true;
  });

  it('should show loading skeleton while data is loading', () => {
    mockGetAll.mockReturnValue(new Promise(() => {}));

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should render the User Management heading after loading', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('User Management')).toBeInTheDocument();
  });

  it('should render the page description', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    expect(screen.getByText('Manage user roles and permissions')).toBeInTheDocument();
  });

  it('should render table column headers', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    // 'User' appears in both the column header and the badge for non-admin users
    expect(screen.getAllByText('User').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Last Login')).toBeInTheDocument();
    // 'Admin' appears in column header and in admin badges
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should show empty state when no users have signed in', async () => {
    mockGetAll.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    expect(screen.getByText('No users have signed in yet.')).toBeInTheDocument();
  });

  it('should display user display names', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('should display user emails', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('should show "No name" for users without a displayName', async () => {
    const usersWithoutName = [
      {
        uid: 'user-noname',
        email: 'noname@example.com',
        displayName: undefined,
        photoURL: null,
        isAdmin: false,
        signInMethods: ['google'],
        createdAt: '2026-01-01T00:00:00Z',
        lastLoginAt: '2026-02-01T00:00:00Z',
      },
    ];

    mockGetAll.mockResolvedValue({ data: usersWithoutName });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    expect(screen.getByText('No name')).toBeInTheDocument();
  });

  it('should show "Admin" badge for admin users', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    const adminBadges = screen.getAllByText('Admin');
    // Bob and Primary Admin are both admins; 'Admin' column header is also present
    // We should have at least 2 badge instances (one for each admin user)
    expect(adminBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('should show "User" badge for non-admin users', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    // 'User' appears as both a column header and as a badge for non-admin users
    expect(screen.getAllByText('User').length).toBeGreaterThanOrEqual(2);
  });

  it('should show "Make Admin" button for non-admin users', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    expect(screen.getByRole('button', { name: 'Make Admin' })).toBeInTheDocument();
  });

  it('should show "Remove Admin" button for admin users (excluding primary admin)', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    expect(screen.getByRole('button', { name: 'Remove Admin' })).toBeInTheDocument();
  });

  it('should show "Primary Admin" label instead of action button for the primary admin email', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    // 'Primary Admin' appears as the displayName in the user column and also as the Actions label
    expect(screen.getAllByText('Primary Admin').length).toBeGreaterThanOrEqual(2);
    // The Actions cell specifically has the label in a styled span (not a button)
    expect(screen.queryByRole('button', { name: 'Primary Admin' })).not.toBeInTheDocument();
  });

  it('should call updateAdmin with toggled admin status when "Make Admin" is clicked', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });
    mockUpdateAdmin.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');

    const makeAdminButton = screen.getByRole('button', { name: 'Make Admin' });
    fireEvent.click(makeAdminButton);

    await waitFor(() => {
      expect(mockUpdateAdmin).toHaveBeenCalledWith('user-1', true);
    });
  });

  it('should call updateAdmin with toggled admin status when "Remove Admin" is clicked', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });
    mockUpdateAdmin.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');

    const removeAdminButton = screen.getByRole('button', { name: 'Remove Admin' });
    fireEvent.click(removeAdminButton);

    await waitFor(() => {
      expect(mockUpdateAdmin).toHaveBeenCalledWith('user-2', false);
    });
  });

  it('should reload users after toggling admin status', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });
    mockUpdateAdmin.mockResolvedValue({ data: {} });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');

    const makeAdminButton = screen.getByRole('button', { name: 'Make Admin' });
    fireEvent.click(makeAdminButton);

    await waitFor(() => {
      // getAll called once on mount, once after toggle
      expect(mockGetAll).toHaveBeenCalledTimes(2);
    });
  });

  it('should display a fallback error message when loading users fails', async () => {
    mockGetAll.mockRejectedValue(new Error('Network error'));

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Failed to load users')).toBeInTheDocument();
  });

  it('should display a fallback error message when toggling admin status fails', async () => {
    mockGetAll.mockResolvedValue({ data: mockUsers });
    mockUpdateAdmin.mockRejectedValue(new Error('Network error'));

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');

    const makeAdminButton = screen.getByRole('button', { name: 'Make Admin' });
    fireEvent.click(makeAdminButton);

    expect(await screen.findByText('Failed to update user')).toBeInTheDocument();
  });

  it('should show Access Denied when user is not a site admin', async () => {
    (globalThis as any).__mockIsAdmin = false;
    (globalThis as any).__mockIsAnyAdmin = false;

    mockGetAll.mockResolvedValue({ data: mockUsers });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You must be an admin to view this page.')).toBeInTheDocument();
  });

  it('should render user photo when photoURL is provided', async () => {
    const usersWithPhoto = [
      {
        uid: 'user-photo',
        email: 'photo@example.com',
        displayName: 'Photo User',
        photoURL: 'https://example.com/photo.jpg',
        isAdmin: false,
        signInMethods: ['google'],
        createdAt: '2026-01-01T00:00:00Z',
        lastLoginAt: '2026-02-01T00:00:00Z',
      },
    ];

    mockGetAll.mockResolvedValue({ data: usersWithPhoto });

    render(
      <RouterWrapper>
        <UsersPage />
      </RouterWrapper>
    );

    await screen.findByText('User Management');
    const img = screen.getByRole('img', { name: 'Photo User' });
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });
});
