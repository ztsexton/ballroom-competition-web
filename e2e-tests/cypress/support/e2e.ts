import './commands';

// Suppress Firebase/auth uncaught exceptions in the test environment
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Firebase') || err.message.includes('auth')) {
    return false;
  }
  return true;
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginWithEmulator(email?: string, password?: string): Chainable<void>;
      createTestCompetitionAndNavigateToSettings(name?: string): Chainable<number>;
    }
  }
}
