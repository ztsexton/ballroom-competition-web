import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock react-router-dom navigate and searchParams
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
  };
});

// Mock the auth context with dynamic values via globalThis
const getAuthMock = () => (globalThis as any).__mockAuth || {
  user: null,
  loading: false,
  login: vi.fn(),
  error: null,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => getAuthMock(),
}));

// Import component after all mocks are set up
import { LoginPage } from '../pages/auth';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockAuth = {
      user: null,
      loading: false,
      login: vi.fn(),
      error: null,
    };
  });

  it('should render sign-in page with correct heading', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Ballroom Scorer')).toBeInTheDocument();
    expect(screen.getByText('Sign in to manage your ballroom dance competitions')).toBeInTheDocument();
    expect(screen.getByText('Secure authentication powered by Google')).toBeInTheDocument();
  });

  it('should show "Sign in with Google" button', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
  });

  it('should display error message when auth error exists', () => {
    (globalThis as any).__mockAuth = {
      user: null,
      loading: false,
      login: vi.fn(),
      error: 'Authentication failed. Please try again.',
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Authentication failed. Please try again.')).toBeInTheDocument();
  });

  it('should call login function when button is clicked', async () => {
    const mockLogin = vi.fn();
    (globalThis as any).__mockAuth = {
      user: null,
      loading: false,
      login: mockLogin,
      error: null,
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /Sign in with Google/i });
    await userEvent.click(button);

    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('should return null when user is already authenticated', () => {
    (globalThis as any).__mockAuth = {
      user: { uid: 'test-user-id', email: 'test@example.com' },
      loading: false,
      login: vi.fn(),
      error: null,
    };

    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(container.innerHTML).toBe('');
  });
});
