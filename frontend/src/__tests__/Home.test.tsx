import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';

// Mock the auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAdmin: true,
    loading: false,
  })),
}));

// Mock the competition context
vi.mock('../context/CompetitionContext', () => ({
  useCompetition: vi.fn(() => ({
    activeCompetition: null,
    competitions: [],
    setActiveCompetition: vi.fn(),
    loading: false,
    refreshCompetitions: vi.fn(() => Promise.resolve()),
  })),
}));

// Mock the API client
vi.mock('../api/client', () => ({
  competitionsApi: {
    getAll: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

// Router wrapper with v7 future flags to suppress deprecation warnings
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </BrowserRouter>
);

describe('Home Page', () => {
  it('should display welcome message', async () => {
    render(
      <RouterWrapper>
        <Home />
      </RouterWrapper>
    );

    expect(await screen.findByText(/Ballroom Scorer/i)).toBeInTheDocument();
  });

  it('should show empty state when no competitions exist', async () => {
    render(
      <RouterWrapper>
        <Home />
      </RouterWrapper>
    );

    expect(await screen.findByText(/No competitions yet/i)).toBeInTheDocument();
  });

  it('should display new competition button with correct link', async () => {
    render(
      <RouterWrapper>
        <Home />
      </RouterWrapper>
    );

    await screen.findByText(/Ballroom Scorer/i);

    const createButton = screen.getByRole('link', { name: /New Competition/i });
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveAttribute('href', '/competitions');
  });
});
