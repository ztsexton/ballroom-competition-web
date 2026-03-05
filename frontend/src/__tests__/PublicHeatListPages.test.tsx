import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetById = vi.fn();
const mockGetPeople = vi.fn();
const mockGetPersonHeatlists = vi.fn();

vi.mock('../api/client', () => ({
  publicCompetitionsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getPeople: (...args: unknown[]) => mockGetPeople(...args),
    getPersonHeatlists: (...args: unknown[]) => mockGetPersonHeatlists(...args),
  },
}));

import PublicHeatListSearchPage from '../pages/public/PublicHeatListSearchPage';
import PublicPersonHeatListPage from '../pages/public/PublicPersonHeatListPage';

function renderSearchPage(competitionId = '1') {
  return render(
    <MemoryRouter
      initialEntries={[`/results/${competitionId}/heatlists`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/results/:competitionId/heatlists" element={<PublicHeatListSearchPage />} />
        <Route path="/results/:competitionId/heatlists/:personId" element={<PublicPersonHeatListPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderPersonPage(competitionId = '1', personId = '10') {
  return render(
    <MemoryRouter
      initialEntries={[`/results/${competitionId}/heatlists/${personId}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/results/:competitionId/heatlists/:personId" element={<PublicPersonHeatListPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicHeatListSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton while data is fetching', () => {
    mockGetById.mockReturnValue(new Promise(() => {}));

    renderSearchPage();

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show "Heatlists" heading and competition name', async () => {
    mockGetById.mockResolvedValue({
      data: { id: 1, name: 'Spring Classic', date: '2025-06-01', type: 'NDCA', heatListsPublished: true },
    });
    mockGetPeople.mockResolvedValue({ data: [] });

    renderSearchPage();

    expect(await screen.findByText('Heatlists')).toBeInTheDocument();
    expect(screen.getByText(/Spring Classic/)).toBeInTheDocument();
  });

  it('should show "not published" message when heatListsPublished is false', async () => {
    mockGetById.mockResolvedValue({
      data: { id: 1, name: 'Spring Classic', date: '2025-06-01', type: 'NDCA', heatListsPublished: false },
    });

    renderSearchPage();

    expect(await screen.findByText(/Heat lists have not been published yet/)).toBeInTheDocument();
  });

  it('should display a searchable list of people', async () => {
    mockGetById.mockResolvedValue({
      data: { id: 1, name: 'Spring Classic', date: '2025-06-01', type: 'NDCA', heatListsPublished: true },
    });
    mockGetPeople.mockResolvedValue({
      data: [
        { id: 10, firstName: 'Travis', lastName: 'Tuft', partnerships: [{ bib: 101, partnerName: 'Zina M' }] },
        { id: 11, firstName: 'Alice', lastName: 'Brown', partnerships: [{ bib: 102, partnerName: 'Bob Green' }] },
      ],
    });

    renderSearchPage();

    expect(await screen.findByText('Travis Tuft')).toBeInTheDocument();
    expect(screen.getByText('Alice Brown')).toBeInTheDocument();
  });

  it('should filter people when searching', async () => {
    const user = userEvent.setup();

    mockGetById.mockResolvedValue({
      data: { id: 1, name: 'Spring Classic', date: '2025-06-01', type: 'NDCA', heatListsPublished: true },
    });
    mockGetPeople.mockResolvedValue({
      data: [
        { id: 10, firstName: 'Travis', lastName: 'Tuft', partnerships: [] },
        { id: 11, firstName: 'Alice', lastName: 'Brown', partnerships: [] },
      ],
    });

    renderSearchPage();

    await screen.findByText('Travis Tuft');

    const searchInput = screen.getByPlaceholderText(/Search/i);
    await user.type(searchInput, 'trav');

    expect(screen.getByText('Travis Tuft')).toBeInTheDocument();
    expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
  });

  it('should link each person to their heatlist page', async () => {
    mockGetById.mockResolvedValue({
      data: { id: 1, name: 'Spring Classic', date: '2025-06-01', type: 'NDCA', heatListsPublished: true },
    });
    mockGetPeople.mockResolvedValue({
      data: [
        { id: 10, firstName: 'Travis', lastName: 'Tuft', partnerships: [] },
      ],
    });

    renderSearchPage();

    const link = await screen.findByRole('link', { name: /Travis Tuft/i });
    expect(link).toHaveAttribute('href', '/results/1/heatlists/10');
  });

  it('should show "No competitors" when the list is empty', async () => {
    mockGetById.mockResolvedValue({
      data: { id: 1, name: 'Spring Classic', date: '2025-06-01', type: 'NDCA', heatListsPublished: true },
    });
    mockGetPeople.mockResolvedValue({ data: [] });

    renderSearchPage();

    expect(await screen.findByText(/No competitors/i)).toBeInTheDocument();
  });
});

describe('PublicPersonHeatListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeleton while fetching', () => {
    mockGetPersonHeatlists.mockReturnValue(new Promise(() => {}));

    renderPersonPage();

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show person name and partner groupings', async () => {
    mockGetPersonHeatlists.mockResolvedValue({
      data: {
        personId: 10,
        firstName: 'Travis',
        lastName: 'Tuft',
        partnerships: [
          {
            bib: 101,
            partnerName: 'Zina Mikhalevsky',
            heats: [
              { heatNumber: 563, estimatedTime: '2026-06-01T13:44:00.000Z', eventName: 'Full Silver Amer. Waltz', round: 'final', style: 'Smooth' },
              { heatNumber: 565, estimatedTime: '2026-06-01T13:46:00.000Z', eventName: 'Full Silver Amer. Tango', round: 'final', style: 'Smooth' },
            ],
          },
          {
            bib: 102,
            partnerName: 'Selene Steelman',
            heats: [
              { heatNumber: 681, estimatedTime: '2026-06-01T18:34:00.000Z', eventName: 'Open Gold Amer. Waltz', round: 'final', style: 'Smooth' },
            ],
          },
        ],
      },
    });

    renderPersonPage();

    // Person heading
    expect(await screen.findByText(/Heat Sheet for/)).toBeInTheDocument();
    expect(screen.getByText('Travis Tuft')).toBeInTheDocument();

    // Partner groupings
    expect(screen.getByText(/Zina Mikhalevsky/)).toBeInTheDocument();
    expect(screen.getByText(/Selene Steelman/)).toBeInTheDocument();

    // Heat entries
    expect(screen.getByText('Full Silver Amer. Waltz')).toBeInTheDocument();
    expect(screen.getByText('Full Silver Amer. Tango')).toBeInTheDocument();
    expect(screen.getByText('Open Gold Amer. Waltz')).toBeInTheDocument();
  });

  it('should group heats by style within each partnership', async () => {
    mockGetPersonHeatlists.mockResolvedValue({
      data: {
        personId: 10,
        firstName: 'Travis',
        lastName: 'Tuft',
        partnerships: [
          {
            bib: 101,
            partnerName: 'Zina M',
            heats: [
              { heatNumber: 10, eventName: 'Silver Waltz', round: 'final', style: 'Smooth' },
              { heatNumber: 11, eventName: 'Silver Tango', round: 'final', style: 'Smooth' },
              { heatNumber: 50, eventName: 'Silver Cha Cha', round: 'final', style: 'Rhythm' },
              { heatNumber: 51, eventName: 'Silver Rumba', round: 'final', style: 'Rhythm' },
            ],
          },
        ],
      },
    });

    renderPersonPage();

    // Both style headings should appear
    expect(await screen.findByText('Smooth')).toBeInTheDocument();
    expect(screen.getByText('Rhythm')).toBeInTheDocument();

    // Events should still be visible
    expect(screen.getByText('Silver Waltz')).toBeInTheDocument();
    expect(screen.getByText('Silver Cha Cha')).toBeInTheDocument();
  });

  it('should show heat numbers in the table', async () => {
    mockGetPersonHeatlists.mockResolvedValue({
      data: {
        personId: 10,
        firstName: 'Travis',
        lastName: 'Tuft',
        partnerships: [
          {
            bib: 101,
            partnerName: 'Zina M',
            heats: [
              { heatNumber: 563, eventName: 'Silver Waltz', round: 'final' },
            ],
          },
        ],
      },
    });

    renderPersonPage();

    await screen.findByText('Silver Waltz');
    expect(screen.getByText('563')).toBeInTheDocument();
  });

  it('should show back link to competitor list', async () => {
    mockGetPersonHeatlists.mockResolvedValue({
      data: {
        personId: 10,
        firstName: 'Travis',
        lastName: 'Tuft',
        partnerships: [],
      },
    });

    renderPersonPage();

    const backLink = await screen.findByRole('link', { name: /Back to Competitor List/i });
    expect(backLink).toHaveAttribute('href', '/results/1/heatlists');
  });

  it('should show error message when request fails', async () => {
    mockGetPersonHeatlists.mockRejectedValue({ response: { data: { error: 'Not found' } } });

    renderPersonPage();

    expect(await screen.findByText(/Not found|Failed/i)).toBeInTheDocument();
  });

  it('should show "No heats" message when partnerships array is empty', async () => {
    mockGetPersonHeatlists.mockResolvedValue({
      data: {
        personId: 10,
        firstName: 'John',
        lastName: 'Doe',
        partnerships: [],
      },
    });

    renderPersonPage();

    expect(await screen.findByText(/No heats found/i)).toBeInTheDocument();
  });
});
