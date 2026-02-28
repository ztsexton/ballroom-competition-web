import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

vi.mock('../context/CompetitionContext', () => ({
  useCompetition: () => ({
    activeCompetition: null,
    setActiveCompetition: vi.fn(),
  }),
}));

// Import component AFTER mocks
import CompetitionDayOfPage from '../pages/competitions/CompetitionDayOfPage';

function renderWithRoute(competitionId = '42') {
  return render(
    <MemoryRouter
      initialEntries={[`/competitions/${competitionId}/dayof`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/competitions/:id/dayof" element={<CompetitionDayOfPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CompetitionDayOfPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page heading and subtitle', () => {
    renderWithRoute();

    expect(screen.getByText('Competition Day Views')).toBeInTheDocument();
    expect(
      screen.getByText('Open these on separate screens or devices during the competition.')
    ).toBeInTheDocument();
  });

  it('should render all four day-of view cards', () => {
    renderWithRoute();

    expect(screen.getByText('On-Deck Captain')).toBeInTheDocument();
    expect(screen.getByText('Live Audience View')).toBeInTheDocument();
    expect(screen.getByText('Judge Scoring')).toBeInTheDocument();
    expect(screen.getByText('Scrutineer')).toBeInTheDocument();
  });

  it('should render descriptions for each view card', () => {
    renderWithRoute();

    expect(
      screen.getByText(
        'See who is on the floor now, who is next, and upcoming heats with couple details.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Public-facing view showing current heat, progress, and what is coming up.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Individual judge scoring interface for phones and tablets.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Enter marks and rankings from paper judging sheets. View and compile results.'
      )
    ).toBeInTheDocument();
  });

  it('should link On-Deck Captain to the correct URL', () => {
    renderWithRoute('42');

    const link = screen.getByRole('link', { name: /On-Deck Captain/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/competitions/42/ondeck');
  });

  it('should link Live Audience View to the correct URL', () => {
    renderWithRoute('42');

    const link = screen.getByRole('link', { name: /Live Audience View/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/competitions/42/live');
  });

  it('should link Judge Scoring to the correct URL', () => {
    renderWithRoute('42');

    const link = screen.getByRole('link', { name: /Judge Scoring/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/competitions/42/judge');
  });

  it('should link Scrutineer to the correct URL', () => {
    renderWithRoute('42');

    const link = screen.getByRole('link', { name: /Scrutineer/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/competitions/42/scrutineer');
  });

  it('should use the competition id from the URL params in all links', () => {
    renderWithRoute('99');

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    links.forEach(link => {
      expect(link.getAttribute('href')).toMatch(/^\/competitions\/99\//);
    });
  });

  it('should render exactly four navigation links', () => {
    renderWithRoute();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
  });
});
