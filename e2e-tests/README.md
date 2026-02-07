# E2E Tests for Competition Settings

End-to-end tests using Cypress to verify that competition settings work correctly.

## Prerequisites

1. Start the development servers:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

2. The app should be running at https://localhost:3000

## Running Tests

### Headless Mode (CI)
```bash
npm run test:e2e
# or
npm run test --workspace e2e-tests
```

### Interactive Mode (Development)
```bash
npm run test:e2e:open
# or
npm run test:open --workspace e2e-tests
```

### Headed Browser Mode
```bash
cd e2e-tests && npm run test:headed
```

## Test Coverage

The E2E test suite provides comprehensive coverage for all critical business flows:

### Test Files

| File | Description |
|------|-------------|
| `authentication.cy.ts` | Login, logout, session management, role-based access |
| `competition-management.cy.ts` | Competition CRUD, settings, duplication, archiving |
| `competition-settings.cy.ts` | All settings sections (general, rules, visibility, etc.) |
| `participant-management.cy.ts` | People, couples, judges management |
| `event-management.cy.ts` | Event CRUD, entries, multi-dance, scholarships |
| `scheduling.cy.ts` | Heat scheduling, conflicts, optimization |
| `scoring-results.cy.ts` | Scoring interface, rankings, skating method |
| `invoicing.cy.ts` | Invoice generation, payments, refunds, reports |
| `public-pages.cy.ts` | Heat lists, results, live updates, portals |
| `error-handling.cy.ts` | Network errors, validation, edge cases |

### Competition Settings Coverage

#### General Section
- Competition name (text input)
- Organization type (button selection)
- Date (date picker)
- Location (text input)
- Description (textarea)

#### Contact & Links Section
- Website URL
- Organizer Email

#### Rules & Scoring Section
- Default Scoring Type (Standard/Proficiency)
- Max Couples Per Heat
- Level Mode (Combined/Integrated)
- Competition Levels (add, remove, reorder, templates)

#### Entry Validation Section
- Entry Level Restrictions toggle
- Levels Above Allowed

#### Age Categories Section
- Add/remove age categories
- Min/Max age settings

#### Floor Size Section
- Default Max Couples on Floor
- Per-Level Overrides

#### Recall & Advancement Section
- Target Final Size
- Final Max Size
- Include Ties toggle

#### Billing Section
- Currency selection

#### Visibility & Access Section
- Public Visibility toggle
- Registration Open toggle
- Public Results toggle
- Heat Lists Published toggle
- Scheduled visibility datetime

### Other Critical Flows

#### Authentication & Authorization
- Google OAuth login
- Session persistence
- Admin vs regular user access
- Protected route handling

#### Participant Management
- CRUD operations for people, couples, judges
- Bib number assignment
- Role management (leader/follower)

#### Event & Scheduling
- Event creation with builder or manual entry
- Heat scheduling and optimization
- Conflict detection and resolution

#### Scoring & Results
- Scrutineer interface
- Judge scoring interface
- Real-time score compilation
- Skating method calculation

#### Invoicing & Payments
- Invoice generation
- Payment recording
- Financial reports

#### Public Pages
- Heat lists display
- Results publication
- Live competition updates

#### Error Handling
- Network failure recovery
- Validation error display
- Empty states
- Concurrent editing conflicts

## Key Test Scenarios

1. **Persistence Tests**: Each setting is changed, the page is reloaded, and the setting is verified to persist.

2. **UI State Consistency**: Rapid changes are made without reloading to ensure the UI stays in sync.

3. **Error Handling**: Failed saves are tested to ensure graceful handling.

## Authentication

Tests use mock Firebase authentication. In a real environment, you may need to:
1. Set up a test user in Firebase
2. Configure test credentials in `cypress.config.ts`
3. Or run the backend in test mode which bypasses auth

## Debugging

- Screenshots are saved on test failure
- Use `cy.pause()` in tests to step through interactively
- Check the Cypress console for detailed logs
