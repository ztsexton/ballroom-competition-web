# Claude Code Instructions

This file provides context and guidelines for working with the Ballroom Competition Scorer codebase.

## Project Overview

**Ballroom Competition Scorer** is a modern web application for managing ballroom dance competitions, scoring, and results. Built with React, Node.js, and TypeScript, it handles:

- People management (dancers as leaders, followers, or both)
- Couples and judges management
- Event creation with automatic round generation
- Scoring system using the skating method (recall rounds and final ranking)
- Real-time results calculation and display

### Key Features
- **Automatic Round Generation**: Based on couple count (1-6: Final only, 7-14: Semi+Final, 15+: Quarter+Semi+Final)
- **JSON File Storage**: No database required, data persists in `backend/data/`
- **Type Safety**: Full TypeScript coverage across frontend and backend
- **REST API**: Clean API design enabling future mobile apps

---

## Architecture & Structure

### Monorepo Structure
```
ballroom-competition-web/
├── backend/           # Node.js + Express + TypeScript API
├── frontend/          # React + Vite + TypeScript SPA
├── data/              # Shared JSON data storage
└── package.json       # Root workspace configuration
```

### Backend Architecture ([backend/](backend/))

**Stack**: Node.js 18+, Express, TypeScript, Jest, Supertest

```
backend/src/
├── __tests__/         # Test files (mirrors src structure)
│   ├── routes/        # API endpoint tests
│   └── services/      # Business logic tests
├── routes/            # API route handlers (thin controllers)
│   ├── people.ts      # People CRUD endpoints
│   ├── couples.ts     # Couples CRUD endpoints
│   ├── judges.ts      # Judges CRUD endpoints
│   └── events.ts      # Events & scoring endpoints
├── services/          # Business logic layer
│   ├── dataService.ts    # JSON file persistence
│   └── scoringService.ts # Scoring calculations (skating system)
├── types/             # Shared TypeScript type definitions
│   └── index.ts
└── server.ts          # Express app initialization
```

**Key Principles**:
- **Routes** are thin controllers that validate input and call services
- **Services** contain all business logic and are framework-agnostic
- **Data layer** is abstracted in `dataService.ts` for potential future migration
- Tests are co-located in `__tests__/` with parallel structure

### Frontend Architecture ([frontend/](frontend/))

**Stack**: React 18, TypeScript, Vite, React Router, Axios, Vitest

```
frontend/src/
├── __tests__/         # Component and integration tests
├── api/               # API client layer
│   └── client.ts      # Axios wrapper with base URL
├── components/        # Reusable UI components
│   └── Navigation.tsx
├── pages/             # Page-level components (route targets)
│   ├── Home.tsx
│   ├── PeoplePage.tsx
│   ├── CouplesPage.tsx
│   ├── JudgesPage.tsx
│   ├── EventsPage.tsx
│   ├── NewEventPage.tsx
│   ├── ScoringPage.tsx
│   └── ResultsPage.tsx
├── context/           # React Context for global state
├── types/             # TypeScript type definitions
│   └── index.ts       # Should mirror backend types
├── App.tsx            # Main app with routing
└── main.tsx           # Entry point
```

**Key Principles**:
- **Pages** are route-level components that compose smaller components
- **Components** are reusable, presentational, and accept props
- **API client** centralizes HTTP requests and error handling
- **Types** should be kept in sync with backend types (consider sharing via npm workspace)

### Data Storage

JSON files in [backend/data/](backend/data/):
- `people.json` - Registered dancers with roles (leader/follower)
- `couples.json` - Couple pairings with bib numbers
- `judges.json` - Competition judges
- `events.json` - Events with heats, rounds, scores, and results

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
- **Routes**: Handle HTTP concerns (request/response, status codes, validation)
- **Services**: Pure business logic, no HTTP dependencies
- **Components**: UI rendering, no direct API calls (use api client)
- **Pages**: Orchestrate API calls, pass data to components

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

**Frontend**:
- Handle loading states and errors in API calls
- Display user-friendly error messages (no stack traces)
- Gracefully degrade on failure (don't crash the app)

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

**Test File Naming**: `*.test.tsx` (e.g., `Home.test.tsx`, `PeoplePage.test.tsx`)

**What to Test**:
- ✅ Component rendering (does it show expected content?)
- ✅ User interactions (clicks, form inputs, navigation)
- ✅ Conditional rendering (loading states, empty states, errors)
- ✅ Integration with API (using mock server or test API)

**Example Test Pattern**:
```typescript
describe('PeoplePage', () => {
  it('should display list of people', async () => {
    render(<PeoplePage />);

    // Wait for data to load
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should add new person on form submit', async () => {
    const user = userEvent.setup();
    render(<PeoplePage />);

    await user.type(screen.getByLabelText(/name/i), 'New Person');
    await user.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText('New Person')).toBeInTheDocument();
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

**Frontend Best Practices**:
- ✅ Use `beforeEach` to clear mocks between tests
- ✅ Use `screen.findBy*` instead of `waitFor(() => screen.getBy*)` for async elements
- ✅ Query by role/label/text (user-visible), not by class/id (implementation)
- ✅ Wait for one element to appear, then query others synchronously
- ✅ Mock API calls at the module level, not component level

**Example: Improved Frontend Test Pattern**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../api/client', () => ({
  eventsApi: {
    getAll: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();  // Reset mocks for isolation
  });

  it('should display content after loading', async () => {
    render(<Home />);

    // Wait for async content to appear
    expect(await screen.findByText(/Welcome/i)).toBeInTheDocument();

    // Then query other elements synchronously
    expect(screen.getByRole('link', { name: /create/i })).toBeInTheDocument();
  });
});
```

### Common Testing Issues & Solutions

**Issue**: Jest doesn't exit after tests complete (hangs)
- **Cause**: Server is started when importing the app module
- **Solution**: Only start server if module is run directly, not imported:
  ```typescript
  // In server.ts
  if (require.main === module) {
    app.listen(PORT, () => console.log('Server started'));
  }
  export default app;
  ```

**Issue**: Vitest can't find `toBeInTheDocument` matcher
- **Cause**: Setup file not loaded in Vitest config
- **Solution**: Add `setupFiles` to [vite.config.ts](frontend/vite.config.ts):
  ```typescript
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts'  // Add this
  }
  ```

**Issue**: Tests run in watch mode in CI, preventing exit
- **Cause**: Frontend `npm test` defaults to watch mode
- **Solution**: Update [frontend/package.json](frontend/package.json):
  ```json
  "scripts": {
    "test": "vitest --run",        // CI mode
    "test:watch": "vitest"         // Dev mode
  }
  ```

---

## Development Workflow

### Starting the Application

**Development Mode** (two terminals):
```bash
# Terminal 1: Backend (http://localhost:3001)
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

The project uses HTTPS in development via `mkcert`. See [HTTPS_SETUP.md](HTTPS_SETUP.md) for details.

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
2. Add service logic in [backend/src/services/](backend/src/services/)
3. Create route handler in [backend/src/routes/](backend/src/routes/)
4. Write tests in [backend/src/__tests__/](backend/src/__tests__/)
5. Update API documentation in [README.md](README.md)

**Frontend (New Page)**:
1. Define types in [frontend/src/types/index.ts](frontend/src/types/index.ts)
2. Create page component in [frontend/src/pages/](frontend/src/pages/)
3. Add API calls in [frontend/src/api/client.ts](frontend/src/api/client.ts)
4. Add route in [frontend/src/App.tsx](frontend/src/App.tsx)
5. Update navigation in [frontend/src/components/Navigation.tsx](frontend/src/components/Navigation.tsx)
6. Write tests in [frontend/src/__tests__/](frontend/src/__tests__/)

---

## Common Patterns

### Backend: Creating a REST API Endpoint

```typescript
// 1. Define type in types/index.ts
export interface Thing {
  id: string;
  name: string;
}

// 2. Add data service method in services/dataService.ts
export function getThings(): Thing[] {
  return readJSONFile<Thing[]>('things.json') || [];
}

// 3. Create route handler in routes/things.ts
import express from 'express';
import { getThings } from '../services/dataService';

const router = express.Router();

router.get('/', (req, res) => {
  const things = getThings();
  res.json(things);
});

export default router;

// 4. Register in server.ts
app.use('/api/things', thingsRouter);
```

### Frontend: Fetching and Displaying Data

```typescript
// 1. Add API call in api/client.ts
export async function getThings(): Promise<Thing[]> {
  const response = await client.get('/api/things');
  return response.data;
}

// 2. Create page component
export function ThingsPage() {
  const [things, setThings] = useState<Thing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getThings()
      .then(setThings)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {things.map(thing => (
        <div key={thing.id}>{thing.name}</div>
      ))}
    </div>
  );
}
```

---

## Project-Specific Knowledge

### Scoring System

The application uses the **skating system** for ballroom competition scoring:

- **Recall Rounds** (Quarter/Semi): Judges mark couples they want to advance (boolean marks)
- **Final Rounds**: Judges rank couples from 1st to Nth place
- **Advancement**: Top N couples advance based on mark count
- **Results**: Calculated using skating method algorithm in [backend/src/services/scoringService.ts](backend/src/services/scoringService.ts)

### Data Relationships

```
Person (leader/follower)
  ↓
Couple (leader_id + follower_id → bib_number)
  ↓
Event (couples[], judges[], rounds[])
  ↓
Round (type: quarter/semi/final, scores{})
  ↓
Score (couple_bib → marks{judge_id: mark/rank})
```

---

## Future Enhancements

Potential areas for expansion (not immediate priorities):

- Multi-dance events (Waltz, Tango, Foxtrot in one event)
- PDF/CSV export of results
- Advanced filtering and search
- Event templates
- Judge assignment management
- Real-time scoring updates (WebSockets)

---

## Questions or Issues?

- Check existing documentation: [README.md](README.md), [QUICKSTART.md](QUICKSTART.md), [MIGRATION.md](MIGRATION.md)
- Review related test files for usage examples
- Look at existing routes/pages for patterns to follow

---

**Last Updated**: 2026-01-30
