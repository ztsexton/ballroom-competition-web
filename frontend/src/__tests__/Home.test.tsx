import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';

// Mock the API client
vi.mock('../api/client', () => ({
  eventsApi: {
    getAll: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

describe('Home Page', () => {
  it('should display welcome message', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome to Ballroom Scorer/i)).toBeInTheDocument();
    });
  });

  it('should show empty state when no events exist', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No events created yet/i)).toBeInTheDocument();
    });
  });

  it('should display create event button', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      const createButton = screen.getByRole('link', { name: /create event/i });
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveAttribute('href', '/events/new');
    });
  });
});
