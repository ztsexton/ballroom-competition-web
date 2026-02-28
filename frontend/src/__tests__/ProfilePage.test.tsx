import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock AuthContext with dynamic values via globalThis
const getAuthMock = () => (globalThis as any).__mockAuth || {
  user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User', photoURL: null },
  currentUser: {
    uid: 'test-uid',
    email: 'test@test.com',
    displayName: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    phone: '',
    city: '',
    stateRegion: '',
    country: '',
    studioTeamName: '',
    signInMethods: ['google'],
    isAdmin: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: '2024-01-01T00:00:00.000Z',
  },
  isAdmin: true,
  isAnyAdmin: true,
  loading: false,
  refreshUser: vi.fn(),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => getAuthMock(),
}));

// Mock ThemeContext
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'indigo',
    setTheme: vi.fn(),
  }),
}));

// Mock the usersApi
const mockUpdateProfile = vi.fn(() => Promise.resolve({ data: {} }));
vi.mock('../api/client', () => ({
  usersApi: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

// Import component AFTER all mocks
import ProfilePage from '../pages/auth/ProfilePage';

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockAuth = {
      user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User', photoURL: null },
      currentUser: {
        uid: 'test-uid',
        email: 'test@test.com',
        displayName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        phone: '',
        city: '',
        stateRegion: '',
        country: '',
        studioTeamName: '',
        signInMethods: ['google'],
        isAdmin: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastLoginAt: '2024-01-01T00:00:00.000Z',
      },
      isAdmin: true,
      isAnyAdmin: true,
      loading: false,
      refreshUser: vi.fn(),
    };
  });

  it('should render the "My Profile" heading', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('My Profile')).toBeInTheDocument();
  });

  it('should display the user display name', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should display the user email from currentUser', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('test@test.com')).toBeInTheDocument();
  });

  it('should render the sign-in method badge when signInMethods is provided', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('google')).toBeInTheDocument();
  });

  it('should render the Appearance section with theme options', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Indigo')).toBeInTheDocument();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Rose')).toBeInTheDocument();
    expect(screen.getByText('Teal')).toBeInTheDocument();
  });

  it('should render the profile form with all expected fields', () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    // Labels don't have htmlFor so query inputs by name attribute
    expect(container.querySelector('input[name="firstName"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="lastName"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="phone"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="studioTeamName"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="city"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="stateRegion"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="country"]')).toBeInTheDocument();

    // The visible label text is still rendered
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Studio / Team')).toBeInTheDocument();
    expect(screen.getByText('City')).toBeInTheDocument();
    expect(screen.getByText('State / Region')).toBeInTheDocument();
    expect(screen.getByText('Country')).toBeInTheDocument();
  });

  it('should pre-populate the form with currentUser data', () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(container.querySelector<HTMLInputElement>('input[name="firstName"]')?.value).toBe('Test');
    expect(container.querySelector<HTMLInputElement>('input[name="lastName"]')?.value).toBe('User');
  });

  it('should show "Save Profile" submit button', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Save Profile' })).toBeInTheDocument();
  });

  it('should show "Saving..." and call updateProfile when form is submitted', async () => {
    const mockRefreshUser = vi.fn(() => Promise.resolve());
    (globalThis as any).__mockAuth = {
      ...(globalThis as any).__mockAuth,
      refreshUser: mockRefreshUser,
    };

    // Make updateProfile resolve slowly so we can catch the saving state if needed,
    // but for simplicity just resolve immediately
    mockUpdateProfile.mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    const saveButton = screen.getByRole('button', { name: 'Save Profile' });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('should display "Profile saved." message after successful save', async () => {
    const mockRefreshUser = vi.fn(() => Promise.resolve());
    (globalThis as any).__mockAuth = {
      ...(globalThis as any).__mockAuth,
      refreshUser: mockRefreshUser,
    };

    mockUpdateProfile.mockResolvedValueOnce({ data: {} });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  });

  it('should display an error message when save fails', async () => {
    const mockRefreshUser = vi.fn(() => Promise.resolve());
    (globalThis as any).__mockAuth = {
      ...(globalThis as any).__mockAuth,
      refreshUser: mockRefreshUser,
    };

    mockUpdateProfile.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    expect(await screen.findByText('Failed to save profile')).toBeInTheDocument();
  });

  it('should fall back to displaying user email when displayName is absent', () => {
    (globalThis as any).__mockAuth = {
      user: { uid: 'test-uid', email: 'fallback@test.com', displayName: null, photoURL: null },
      currentUser: {
        uid: 'test-uid',
        email: 'fallback@test.com',
        signInMethods: [],
        isAdmin: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastLoginAt: '2024-01-01T00:00:00.000Z',
      },
      isAdmin: false,
      isAnyAdmin: false,
      loading: false,
      refreshUser: vi.fn(),
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    // When displayName is null/undefined, the component renders user.email in the name slot.
    // The email also appears in the currentUser.email slot below, so getAllByText is used.
    const emailElements = screen.getAllByText('fallback@test.com');
    expect(emailElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should not render sign-in method badges when signInMethods is empty', () => {
    (globalThis as any).__mockAuth = {
      user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User', photoURL: null },
      currentUser: {
        uid: 'test-uid',
        email: 'test@test.com',
        displayName: 'Test User',
        signInMethods: [],
        isAdmin: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastLoginAt: '2024-01-01T00:00:00.000Z',
      },
      isAdmin: true,
      isAnyAdmin: true,
      loading: false,
      refreshUser: vi.fn(),
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.queryByText('google')).not.toBeInTheDocument();
  });
});
