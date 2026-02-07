// Cypress E2E support file
import './commands';

// Prevent Cypress from failing on uncaught exceptions in the app
Cypress.on('uncaught:exception', (err) => {
  // Firebase auth errors in test environment
  if (err.message.includes('Firebase') || err.message.includes('auth')) {
    return false;
  }
  return true;
});

// Log API requests for debugging
Cypress.on('window:before:load', (win) => {
  cy.spy(win.console, 'error').as('consoleError');
});

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login as admin user by mocking Firebase auth
       */
      loginAsAdmin(): Chainable<void>;

      /**
       * Create a test competition and navigate to its settings
       */
      createTestCompetitionAndNavigateToSettings(name?: string): Chainable<number>;

      /**
       * Wait for the "Saved" indicator to appear and disappear
       */
      waitForSaved(section: string): Chainable<void>;

      /**
       * Get an input by its label text
       */
      getByLabel(label: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Get a section by its title
       */
      getSection(title: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Expand a section if it's collapsed
       */
      expandSection(title: string): Chainable<void>;
    }
  }
}
