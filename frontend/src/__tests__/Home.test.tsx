import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';

// Mock the API client
vi.mock('../api/client', () => ({
  eventsApi: {
    getAll: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

describe('Home Page', () => {
  beforeEach(() => {
    // Reset mocks between tests for isolation
    vi.clearAllMocks();
  });

  it('should display welcome message', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    // Use findBy* instead of waitFor + getBy for async elements
    expect(await screen.findByText(/Welcome to Ballroom Scorer/i)).toBeInTheDocument();
  });

  it('should show empty state when no events exist', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    expect(await screen.findByText(/No events created yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Get started by creating your first event/i)).toBeInTheDocument();
  });

  it('should display create event button with correct link', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    // Wait for the page to load, then check the button
    await screen.findByText(/Welcome to Ballroom Scorer/i);

    const createButton = screen.getByRole('link', { name: /create event/i });
    expect(createButton).toBeInTheDocument();
    expect(createButton).toHaveAttribute('href', '/events/new');
  });
});
