/// <reference types="cypress" />

// Mock Firebase auth state for testing
Cypress.Commands.add('loginAsAdmin', () => {
  // If auth is disabled (running against testcontainers), skip Firebase mocking
  if (Cypress.env('AUTH_DISABLED') === 'true') {
    // Just set up mock user in localStorage for frontend state
    cy.window().then((win) => {
      const mockUser = {
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test Admin',
        isAdmin: true,
      };
      win.localStorage.setItem('mockAuthUser', JSON.stringify(mockUser));
    });
    return;
  }

  // Intercept Firebase auth calls to return a mock user
  cy.intercept('POST', '**/identitytoolkit.googleapis.com/**', {
    statusCode: 200,
    body: {
      idToken: 'mock-id-token',
      email: 'test@example.com',
      refreshToken: 'mock-refresh-token',
      expiresIn: '3600',
      localId: 'test-user-id',
    },
  }).as('firebaseAuth');

  // Intercept token refresh
  cy.intercept('POST', '**/securetoken.googleapis.com/**', {
    statusCode: 200,
    body: {
      id_token: 'mock-id-token',
      refresh_token: 'mock-refresh-token',
      expires_in: '3600',
    },
  });

  // Intercept API calls and add mock auth (backend in test mode should accept this)
  cy.intercept('/api/**', (req) => {
    req.headers['Authorization'] = 'Bearer mock-test-token';
  });

  // Set up mock user in localStorage (for Firebase persistence)
  cy.window().then((win) => {
    const mockUser = {
      uid: 'test-user-id',
      email: 'test@example.com',
      displayName: 'Test Admin',
      isAdmin: true,
    };
    win.localStorage.setItem('mockAuthUser', JSON.stringify(mockUser));
  });
});

Cypress.Commands.add('createTestCompetitionAndNavigateToSettings', (name = 'Test Competition') => {
  // Go to home page
  cy.visit('/');

  // Click "New Competition" button
  cy.contains('a', 'New Competition').click();

  // Fill in competition form
  cy.get('input[placeholder*="Competition Name"], input[name="name"]').first().type(name);
  cy.get('input[type="date"]').first().type('2026-06-15');
  cy.get('input[placeholder*="Location"], input[name="location"]').first().type('Test City, TS');

  // Submit the form
  cy.contains('button', 'Create').click();

  // Wait for redirect to competition details
  cy.url().should('include', '/competitions/');

  // Extract competition ID from URL and navigate to settings
  cy.url().then((url) => {
    const match = url.match(/\/competitions\/(\d+)/);
    if (match) {
      const compId = parseInt(match[1]);
      cy.visit(`/competitions/${compId}/settings`);
      cy.wrap(compId);
    }
  });
});

Cypress.Commands.add('waitForSaved', (section: string) => {
  // Look for the "Saved" text within the section
  cy.contains('Saved', { timeout: 5000 }).should('be.visible');

  // Wait for it to disappear (the flash is 2 seconds)
  cy.contains('Saved', { timeout: 5000 }).should('not.exist');
});

Cypress.Commands.add('getByLabel', (label: string) => {
  return cy.contains('label', label).parent().find('input, select, textarea');
});

Cypress.Commands.add('getSection', (title: string) => {
  return cy.contains('h3', title).closest('.card');
});

Cypress.Commands.add('expandSection', (title: string) => {
  cy.contains('h3', title).then(($h3) => {
    // Check if section is collapsed (arrow pointing right)
    if ($h3.text().includes('▸')) {
      cy.wrap($h3).click();
    }
  });
});
