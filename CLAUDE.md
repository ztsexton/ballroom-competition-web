# Claude Code Instructions

This file provides context and guidelines for working with the Ballroom Competition Scorer codebase.

## Project Overview

**Ballroom Competition Scorer** is a full-featured web application for managing ballroom dance competitions, scoring, and results. Built with React, Node.js, and TypeScript, it handles:

- Competition management with multiple competition types (NDCA, USA Dance, WDC, WDSF, Studio, Unaffiliated)
- People management (dancers as leaders, followers, or both)
- Couples and judges management
- Event creation with automatic round generation
- Scoring system using the skating method (recall rounds and final ranking)
- Real-time results calculation and display via SSE
- Day-of competition operations (heat runner, judge scoring, scrutineering)
- Scheduling with back-to-back conflict detection
- Invoice generation and PDF export
- Public-facing results, heat lists, and registration
- Participant self-service portal

### Key Features
- **Automatic Round Generation**: Based on couple count (1-6: Final only, 7-14: Semi+Final, 15+: Quarter+Semi+Final)
- **Dual Data Storage**: JSON file storage (no database required) or PostgreSQL via `DATA_STORE` env var
- **Firebase Authentication**: Google sign-in with role-based access (site admin, competition admin)
- **Competition Admin Roles**: Users can be designated as admins for specific competitions without full site admin access
- **Type Safety**: Full TypeScript coverage across frontend and backend
- **REST API**: Clean API design with 16 route modules and 80+ endpoints
- **Tailwind CSS**: Utility-first styling across all frontend components

---

## Architecture & Structure

### Monorepo Structure
```
competition-software/
├── backend/           # Node.js + Express + TypeScript API
├── frontend/          # React + Vite + TypeScript SPA
└── package.json       # Root workspace configuration
```

### Backend Architecture ([backend/](backend/))

**Stack**: Node.js 18+, Express, TypeScript, Jest, Supertest, Firebase Admin SDK

```
backend/src/
├── __tests__/              # Test files (mirrors src structure)
│   ├── routes/             # API endpoint tests (15 files)
│   ├── services/           # Business logic tests (14 files)
│   │   └── data/           # Data service tests (2 files)
│   ├── constants/          # Constants tests
│   └── performance.test.ts
├── config/
│   └── firebase.ts         # Firebase Admin SDK initialization
├── constants/
│   ├── rounds.ts           # Round generation rules
│   └── levels.ts           # Proficiency level definitions
├── middleware/
│   └── auth.ts             # authenticate, requireAdmin, requireAnyAdmin, assertCompetitionAccess
├── routes/                 # API route handlers (16 files)
│   ├── competitions.ts     # Competition CRUD + admin management
│   ├── people.ts           # People CRUD (competition-scoped)
│   ├── couples.ts          # Couples CRUD (competition-scoped)
│   ├── judges.ts           # Judges CRUD (competition-scoped)
│   ├── events.ts           # Events, scoring, results
│   ├── schedules.ts        # Schedule generation & heat management
│   ├── invoices.ts         # Invoice computation & PDF/email
│   ├── scrutineer.ts       # Paper judging & score compilation
│   ├── judging.ts          # Live judge scoring during competition
│   ├── participant.ts      # Self-service registration portal
│   ├── users.ts            # User management & admin-competitions
│   ├── studios.ts          # Studio CRUD (site admin only)
│   ├── organizations.ts    # Organization CRUD (site admin only)
│   ├── mindbody.ts         # MindBody integration
│   ├── public.ts           # Public endpoints (no auth)
│   └── database.ts         # Health check & schema migration
├── services/               # Business logic layer
│   ├── dataService.ts      # Data service factory (creates appropriate implementation)
│   ├── scoringService.ts   # Scoring calculations (recall, final, multi-dance)
│   ├── skatingSystem.ts    # Skating method algorithm (majority rule, tie-breaking)
│   ├── registrationService.ts  # Couple registration / find-or-create
│   ├── validationService.ts    # NDCA age rules, level validation
│   ├── invoiceService.ts   # Invoice calculation
│   ├── pdfService.ts       # PDF generation
│   ├── emailService.ts     # Email delivery
│   ├── sseService.ts       # Server-sent events for real-time updates
│   ├── timingService.ts    # Heat timing calculations
│   ├── mindbodyService.ts  # MindBody API client
│   ├── migrationService.ts # Schema migration runner
│   ├── data/               # Data access layer
│   │   ├── IDataService.ts         # Interface (contract for all implementations)
│   │   ├── PostgresDataService.ts  # PostgreSQL implementation
│   │   ├── JsonDataService.ts      # JSON file implementation
│   │   ├── CachingDataService.ts   # Caching wrapper (decorates any IDataService)
│   │   ├── createDataService.ts    # Factory function
│   │   ├── schema.sql              # PostgreSQL schema + migrations
│   │   └── helpers.ts
│   └── schedule/           # Schedule management subsystem
│       ├── index.ts                # ScheduleService (main facade)
│       ├── scheduleGenerator.ts    # Schedule generation algorithm
│       ├── heatNavigation.ts       # Advance/back/jump state machine
│       ├── heatStatus.ts           # Heat status tracking
│       ├── scheduleModification.ts # Reorder/insert/break operations
│       ├── backToBack.ts           # Back-to-back conflict detection
│       ├── judgeAssignment.ts      # Judge panel assignment
│       └── helpers.ts
├── types/
│   └── index.ts            # All TypeScript interfaces
├── utils/
│   └── logger.ts           # Pino logger
└── server.ts               # Express app initialization & route mounting
```

**Key Principles**:
- **Routes** are thin controllers that validate input and call services
- **Services** contain all business logic and are framework-agnostic
- **Data layer** is abstracted via `IDataService` interface with JSON, PostgreSQL, and Caching implementations
- Tests are co-located in `__tests__/` with parallel structure (33 test files, 715+ tests)

### Authentication & Authorization

The backend uses a three-tier auth model defined in `middleware/auth.ts`:

1. **No auth**: `/api/health`, `/api/database`, `/api/public` — open endpoints
2. **Authenticated**: `/api/users`, `/api/judging`, `/api/participant` — any logged-in user
3. **Competition-scoped**: `/api/competitions`, `/api/people`, `/api/couples`, `/api/judges`, `/api/events`, `/api/schedules`, `/api/invoices`, `/api/scrutineer` — access checks at handler level via `requireAnyAdmin` + `assertCompetitionAccess`
4. **Site-admin-only**: `/api/studios`, `/api/organizations`, `/api/mindbody` — `requireAdmin` middleware at mount level

Key middleware:
- `authenticate` — verifies Firebase token, upserts user, attaches `req.user`
- `requireAdmin` — passes only if `req.user.isAdmin`
- `requireAnyAdmin` — passes if site admin OR competition admin for any competition
- `assertCompetitionAccess(req, res, competitionId)` — passes if site admin OR competition admin for a specific competition; sends 403 if denied

### Frontend Architecture ([frontend/](frontend/))

**Stack**: React 18, TypeScript, Vite, React Router, Axios, Vitest, Tailwind CSS v4, Firebase Auth

```
frontend/src/
├── __tests__/              # Component and integration tests (5 files)
├── api/
│   └── client.ts           # Axios wrapper with auth token injection
├── components/             # Reusable UI components
│   ├── Navigation.tsx      # Main nav bar (uses isAnyAdmin)
│   ├── ProtectedRoute.tsx  # Auth-gated route wrapper
│   ├── PublicLayout.tsx    # Layout for public pages
│   ├── CompetitionHubLayout.tsx  # Layout for competition-scoped pages
│   ├── Skeleton.tsx        # Loading skeleton component
│   ├── CompetitionTypeBadge.tsx  # Competition type badge
│   ├── StatusBadge.tsx     # Status indicator badge
│   └── results/            # Results display components
│       ├── JudgeGrid.tsx
│       ├── SkatingBreakdown.tsx
│       └── MultiDanceSummary.tsx
├── config/
│   └── firebase.ts         # Firebase client SDK initialization
├── context/                # React Context providers
│   ├── AuthContext.tsx      # User auth state, isAdmin, isAnyAdmin, isCompetitionAdmin
│   ├── CompetitionContext.tsx  # Active competition state
│   └── ThemeContext.tsx     # Theme switching (4 color themes)
├── pages/
│   ├── Home.tsx             # Dashboard with competition list
│   ├── admin/               # Site administration
│   │   ├── AdminDashboardPage.tsx  # Admin hub (Users/Studios/Orgs cards + competitions)
│   │   ├── UsersPage.tsx
│   │   ├── StudioPage.tsx
│   │   └── OrganizationsPage.tsx
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── ProfilePage.tsx
│   ├── competitions/        # Competition management
│   │   ├── CompetitionsPage.tsx
│   │   ├── CompetitionDetailsPage.tsx
│   │   ├── CompetitionSettingsPage.tsx  # Includes competition admin management
│   │   ├── CompetitionEntriesPage.tsx
│   │   └── CompetitionDayOfPage.tsx
│   ├── participants/        # People & couples within a competition
│   │   ├── PeoplePage.tsx
│   │   ├── CouplesPage.tsx
│   │   ├── JudgesPage.tsx
│   │   ├── InvoicesPage.tsx
│   │   └── ParticipantPortalPage.tsx
│   ├── events/              # Event management & results
│   │   ├── EventsPage.tsx
│   │   ├── EventFormPage.tsx
│   │   ├── EventEntriesPage.tsx
│   │   ├── ScoreEventPage.tsx
│   │   └── ResultsPage.tsx
│   ├── dayof/               # Day-of competition operations
│   │   ├── RunCompetition/
│   │   │   ├── RunCompetitionPage.tsx
│   │   │   └── components/ (HeatSidebar, ResetModal, ScoringProgressPanel)
│   │   ├── JudgeScoring/
│   │   │   ├── JudgeScoringPage.tsx
│   │   │   └── components/ (RecallForm, RankingForm, TapToRankForm, etc.)
│   │   ├── Schedule/
│   │   │   ├── SchedulePage.tsx
│   │   │   └── components/ (ScheduleHeatTable, ScheduleConfigForm, etc.)
│   │   ├── ScrutineerPage.tsx
│   │   ├── OnDeckPage.tsx
│   │   └── LiveCompetitionPage.tsx
│   └── public/              # Public-facing pages (no auth)
│       ├── PublicHomePage.tsx
│       ├── PublicResultsPage.tsx
│       ├── PublicHeatListsPage.tsx
│       ├── PricingPage.tsx
│       ├── FaqPage.tsx
│       └── PaymentPage.tsx
├── types/
│   └── index.ts             # Mirrors backend types
├── App.tsx                  # Main app with routing
├── App.css                  # Tailwind CSS entry (@import "tailwindcss")
└── main.tsx                 # Entry point
```

**Key Principles**:
- **Pages** are route-level components that compose smaller components
- **Components** are reusable, presentational, and accept props
- **API client** centralizes HTTP requests with automatic auth token injection
- **Context providers** manage global state (auth, active competition, theme)
- **Types** should be kept in sync with backend types
- **Tailwind CSS** is used for all styling — no CSS modules or styled-components

### Data Storage

The app supports two data backends, selected via `DATA_STORE` env var:

**JSON files** (default, `DATA_STORE=json` or unset):
- Stored in `backend/data/`
- No database setup required
- Good for development and small competitions

**PostgreSQL** (`DATA_STORE=postgres`):
- Schema defined in `backend/src/services/data/schema.sql`
- Migrations run via `POST /api/database/migrate`
- Uses `CachingDataService` wrapper for performance
- Required for production use

---

## Coding Standards

### TypeScript

**Configuration**: Strict mode enabled ([backend/tsconfig.json](backend/tsconfig.json))
- `"strict": true` - All strict type checking enabled
- No `any` types in production code (use `unknown` if truly needed)
- Prefer interfaces over types for object shapes
- Use type inference where obvious, explicit types for function signatures

**Naming Conventions**:
- **Files**: camelCase for utilities, PascalCase for components (e.g., `scoringService.ts`, `HomePage.tsx`)
- **Variables/Functions**: camelCase (e.g., `calculateResults`, `eventData`)
- **Types/Interfaces**: PascalCase (e.g., `Person`, `Event`, `ScoringResult`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g., `MAX_COUPLES_FOR_FINAL`)
- **Components**: PascalCase function declarations (e.g., `export function HomePage()`)

**Type Sharing**:
- Backend defines canonical types in [backend/src/types/index.ts](backend/src/types/index.ts)
- Frontend mirrors these in [frontend/src/types/index.ts](frontend/src/types/index.ts)
- Keep types synchronized manually or consider sharing via workspace imports

### Code Organization

**Separation of Concerns**:
- **Routes**: Handle HTTP concerns (request/response, status codes, validation, auth checks)
- **Services**: Pure business logic, no HTTP dependencies
- **Components**: UI rendering, no direct API calls (use api client)
- **Pages**: Orchestrate API calls, pass data to components
- **Context**: Global state management (auth, competition, theme)

**Single Responsibility**:
- Each file should have ONE clear purpose
- Functions should do ONE thing well
- Components should have ONE reason to change

**DRY (Don't Repeat Yourself)**:
- Extract repeated logic into utilities
- Create reusable components for common UI patterns
- Share types between related modules

**Avoid Over-Engineering**:
- Only build what's needed NOW, not for hypothetical futures
- Don't add features, refactoring, or "improvements" beyond what's asked
- Three similar lines are better than a premature abstraction
- No docstrings, comments, or type annotations on code you didn't change

### Error Handling

**Backend**:
- Return proper HTTP status codes (200, 201, 400, 404, 500)
- Validate input at API boundaries (routes)
- Send clear, user-friendly error messages
- Log errors server-side for debugging
- Auth middleware is fault-tolerant (gracefully denies if `competition_admins` table doesn't exist)

**Frontend**:
- Handle loading states and errors in API calls
- Display user-friendly error messages (no stack traces)
- Gracefully degrade on failure (don't crash the app)
- `AuthContext` uses `Promise.allSettled` so a single API failure doesn't break auth

### API Design

**RESTful Conventions**:
- `GET /api/resource` - List all
- `GET /api/resource/:id` - Get by ID
- `POST /api/resource` - Create new
- `PATCH /api/resource/:id` - Update existing (partial)
- `DELETE /api/resource/:id` - Delete by ID

**Request/Response**:
- Accept JSON in request body
- Return JSON in response body
- Include appropriate `Content-Type` headers

---

## Testing Guidelines

### Testing Philosophy

**Behavior-Focused, Not Implementation-Focused**:
- Test **what** the code does, not **how** it does it
- Tests should remain stable when refactoring internals
- Focus on user-facing behavior and API contracts

**Integration Over Unit**:
- Prefer testing entire flows (API endpoint → service → data)
- Unit tests for complex isolated logic (e.g., scoring calculations)
- Avoid mocking unless necessary (prefer real collaborators)

**User-Centric Frontend Tests**:
- Simulate real user interactions (clicks, typing, navigation)
- Query by user-visible elements (text, labels, roles), not implementation details
- Avoid testing React internals (state, props, lifecycle)

### Backend Testing

**Framework**: Jest + Supertest

**Test Location**: [backend/src/__tests__/](backend/src/__tests__/) mirroring `src/` structure

**Test File Naming**: `*.test.ts` (e.g., `events.test.ts`, `scoringService.test.ts`)

**Current State**: 33 test files, 715+ tests

**What to Test**:
- ✅ API endpoints (request → response, status codes, error cases)
- ✅ Business logic (scoring calculations, data transformations)
- ✅ Data persistence (create, read, update, delete operations)
- ✅ Edge cases (empty data, invalid input, boundary conditions)

**Example Test Pattern**:
```typescript
describe('POST /api/events', () => {
  it('should create a new event with correct rounds', async () => {
    const response = await request(app)
      .post('/api/events')
      .send({ name: 'Test Event', couples: 12 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Test Event',
      rounds: ['semi-final', 'final']
    });
  });
});
```

**Running Tests**:
```bash
cd backend
npm test                # Run once
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

### Frontend Testing

**Framework**: Vitest + React Testing Library

**Test Location**: [frontend/src/__tests__/](frontend/src/__tests__/)

**Test File Naming**: `*.test.tsx` (e.g., `Home.test.tsx`, `ResultsPage.test.tsx`)

**Current State**: 5 test files, 22 tests

**What to Test**:
- ✅ Component rendering (does it show expected content?)
- ✅ User interactions (clicks, form inputs, navigation)
- ✅ Conditional rendering (loading states, empty states, errors)
- ✅ Integration with API (using mock server or test API)

**Example Test Pattern**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../api/client', () => ({
  eventsApi: {
    getAll: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isAnyAdmin: true,
    loading: false,
  }),
}));

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display content after loading', async () => {
    render(<Home />);
    expect(await screen.findByText(/Welcome/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create/i })).toBeInTheDocument();
  });
});
```

**Running Tests**:
```bash
cd frontend
npm test                # Run once (CI mode)
npm run test:watch      # Watch mode for development
npm run test:coverage   # With coverage
npm run test:ui         # Visual UI mode
```

### Test Coverage Goals

- **Target**: 70%+ coverage overall
- **Critical Paths**: 90%+ coverage for scoring logic and core workflows
- **Don't Chase 100%**: Focus on valuable tests, not coverage metrics

### Testing Best Practices

**Backend Best Practices**:
- ✅ Use `beforeEach` to reset data for test isolation
- ✅ Test API endpoints end-to-end with supertest
- ✅ Test edge cases and error conditions
- ✅ Keep tests focused on behavior, not implementation
- ✅ In test environment, auth middleware auto-assigns admin user (`test-user-id`)

**Frontend Best Practices**:
- ✅ Use `beforeEach` to clear mocks between tests
- ✅ Use `screen.findBy*` instead of `waitFor(() => screen.getBy*)` for async elements
- ✅ Query by role/label/text (user-visible), not by class/id (implementation)
- ✅ Wait for one element to appear, then query others synchronously
- ✅ Mock API calls at the module level, not component level
- ✅ Always mock `useAuth` with `isAnyAdmin` in addition to `isAdmin`
- ✅ Mock `useCompetition` when testing competition-scoped pages

### Common Testing Issues & Solutions

**Issue**: Jest doesn't exit after tests complete (hangs)
- **Cause**: Server is started when importing the app module
- **Solution**: Only start server if not in test environment:
  ```typescript
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT);
  }
  ```

**Issue**: Vitest can't find `toBeInTheDocument` matcher
- **Cause**: Setup file not loaded in Vitest config
- **Solution**: Add `setupFiles` to [vite.config.ts](frontend/vite.config.ts):
  ```typescript
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts'
  }
  ```

**Issue**: Frontend tests fail with missing `isAnyAdmin`
- **Cause**: `useAuth` mock doesn't include `isAnyAdmin` — pages that check `isAnyAdmin` get `undefined`
- **Solution**: Always include `isAnyAdmin` in auth mocks:
  ```typescript
  vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({ isAdmin: true, isAnyAdmin: true, loading: false }),
  }));
  ```

---

## Development Workflow

### Starting the Application

**Quick Start** (single command):
```bash
./start.sh    # Starts both frontend and backend
```

**Development Mode** (two terminals):
```bash
# Terminal 1: Backend (https://localhost:3001)
cd backend
npm run dev

# Terminal 2: Frontend (https://localhost:3000)
cd frontend
npm run dev
```

**Production Build**:
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

### HTTPS Setup

The project uses HTTPS in development via `mkcert`. See [doc/setup/HTTPS_SETUP.md](doc/setup/HTTPS_SETUP.md) for details.

### Database Migration

When using PostgreSQL (`DATA_STORE=postgres`), run migrations after starting the backend:
```bash
curl -X POST https://localhost:3001/api/database/migrate
```
Migrations are idempotent (safe to run multiple times).

### Making Changes

1. **Read Before Modifying**: Always read existing files before making changes
2. **Follow Existing Patterns**: Match the style and structure of surrounding code
3. **Update Types First**: Define or update TypeScript types before implementation
4. **Write Tests**: Add tests for new features or bug fixes
5. **Test Locally**: Run tests and manual testing before considering done
6. **Update Documentation**: Update README or this file if architecture changes

### Adding New Features

**Backend (API Endpoint)**:
1. Define types in [backend/src/types/index.ts](backend/src/types/index.ts)
2. Add data service methods to `IDataService` interface and all implementations
3. Add service logic in [backend/src/services/](backend/src/services/)
4. Create route handler in [backend/src/routes/](backend/src/routes/) with appropriate auth checks
5. Mount route in [backend/src/server.ts](backend/src/server.ts)
6. Write tests in [backend/src/__tests__/](backend/src/__tests__/)

**Frontend (New Page)**:
1. Define types in [frontend/src/types/index.ts](frontend/src/types/index.ts)
2. Create page component in [frontend/src/pages/](frontend/src/pages/)
3. Add API calls in [frontend/src/api/client.ts](frontend/src/api/client.ts)
4. Add route in [frontend/src/App.tsx](frontend/src/App.tsx)
5. Update navigation in [frontend/src/components/Navigation.tsx](frontend/src/components/Navigation.tsx) if needed
6. Write tests in [frontend/src/__tests__/](frontend/src/__tests__/)

---

## Project-Specific Knowledge

### Scoring System

The application uses the **skating system** for ballroom competition scoring:

- **Recall Rounds** (Quarter/Semi): Judges mark couples they want to advance (boolean marks)
- **Final Rounds**: Judges rank couples from 1st to Nth place
- **Proficiency Events**: Judges score on a numeric scale
- **Advancement**: Top N couples advance based on mark count (rules R1-R4 in [doc/spec/scoring.md](doc/spec/scoring.md))
- **Results**: Calculated using skating method algorithm in [backend/src/services/skatingSystem.ts](backend/src/services/skatingSystem.ts)
- **Multi-dance**: Per-dance results aggregated into overall placement

### Data Relationships

```
Competition
  ├── People (leaders, followers)
  ├── Couples (leader + follower → bib number)
  ├── Judges (with judge numbers)
  ├── Events (couples[], judges[], rounds[])
  │     └── Heats (round, bibs[], judges[], scores{})
  ├── Schedule (heat order, statuses, timing)
  ├── CompetitionAdmins (user UIDs with admin role)
  └── Invoices (computed from entries + fee structure)
```

---

## Questions or Issues?

- Check existing documentation: [README.md](README.md), [doc/setup/QUICKSTART.md](doc/setup/QUICKSTART.md), [doc/MIGRATION.md](doc/MIGRATION.md), [doc/deployment/DEPLOYMENT.md](doc/deployment/DEPLOYMENT.md)
- Review related test files for usage examples
- Look at existing routes/pages for patterns to follow

---

**Last Updated**: 2026-02-25
