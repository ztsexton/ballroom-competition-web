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

// Mock the API client
vi.mock('../api/client', () => ({
  competitionsApi: {
    getAll: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

describe('Home Page', () => {
  it('should display welcome message', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Ballroom Scorer/i)).toBeInTheDocument();
  });

  it('should show empty state when no competitions exist', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    expect(await screen.findByText(/No competitions yet/i)).toBeInTheDocument();
  });

  it('should display new competition button with correct link', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await screen.findByText(/Ballroom Scorer/i);

    const createButton = screen.getByRole('link', { name: /New Competition/i });
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveAttribute('href', '/competitions');
  });
});
