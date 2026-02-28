import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetCompetitions = vi.fn();
const mockGetProfile = vi.fn();
const mockGetMyEntries = vi.fn();

vi.mock('../api/client', () => ({
  participantApi: {
    getCompetitions: (...args: unknown[]) => mockGetCompetitions(...args),
    getCompetition: vi.fn(() => Promise.resolve({ data: {} })),
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    register: vi.fn(() => Promise.resolve({ data: {} })),
    addPartner: vi.fn(() => Promise.resolve({ data: { partner: {}, couple: {} } })),
    getMyEntries: (...args: unknown[]) => mockGetMyEntries(...args),
    registerEntry: vi.fn(() => Promise.resolve({ data: { event: {}, created: true } })),
    removeEntry: vi.fn(() => Promise.resolve({})),
    getAgeCategories: vi.fn(() => Promise.resolve({ data: [] })),
    getAllowedLevels: vi.fn(() => Promise.resolve({
      data: { validationEnabled: false, allowedLevels: [], coupleLevel: null, allLevels: [] },
    })),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: (globalThis as any).__mockUser || { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User' },
    isAdmin: false,
    isAnyAdmin: false,
    loading: false,
  }),
}));

import { ParticipantPortalPage } from '../pages/participants';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </MemoryRouter>
);

describe('ParticipantPortalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__mockUser = { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User' };
  });

  it('should show loading state initially', () => {
    mockGetCompetitions.mockReturnValue(new Promise(() => {}));

    render(
      <RouterWrapper>
        <ParticipantPortalPage />
      </RouterWrapper>
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should show "no competitions" message when none are open', async () => {
    mockGetCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <ParticipantPortalPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/no competitions/i)).toBeInTheDocument();
  });

  it('should show competition list when competitions are available', async () => {
    mockGetCompetitions.mockResolvedValue({
      data: [
        { id: 1, name: 'Spring Open', type: 'UNAFFILIATED', date: '2026-06-01', registrationOpen: true, createdAt: '2026-01-01' },
        { id: 2, name: 'Fall Classic', type: 'NDCA', date: '2026-09-01', registrationOpen: true, createdAt: '2026-01-01' },
      ],
    });

    render(
      <RouterWrapper>
        <ParticipantPortalPage />
      </RouterWrapper>
    );

    expect(await screen.findByText('Spring Open')).toBeInTheDocument();
    expect(screen.getByText('Fall Classic')).toBeInTheDocument();
  });

  it('should show page heading', async () => {
    mockGetCompetitions.mockResolvedValue({ data: [] });

    render(
      <RouterWrapper>
        <ParticipantPortalPage />
      </RouterWrapper>
    );

    expect(await screen.findByText(/Participant Portal/i)).toBeInTheDocument();
  });
});
