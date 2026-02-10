/// <reference types="cypress" />

Cypress.Commands.add('loginWithEmulator', (email?: string, password?: string) => {
  const userEmail = email || Cypress.env('TEST_USER_EMAIL');
  const userPassword = password || Cypress.env('TEST_USER_PASSWORD');

  cy.visit('/login');
  cy.window().its('__testLogin').should('exist');
  cy.window().invoke('__testLogin', userEmail, userPassword);
  cy.url().should('not.include', '/login', { timeout: 15000 });
});

Cypress.Commands.add('createTestCompetitionAndNavigateToSettings', (name = 'Test Competition') => {
  cy.visit('/dashboard');
  cy.contains('a', 'New Competition').click();
  cy.url().should('include', '/competitions');

  cy.contains('button', 'New Competition').click();
  cy.get('input[name="name"]').type(name);
  cy.get('input[type="date"]').first().clear().type('2026-06-15');

  cy.contains('button', 'Create Competition').click();
  cy.contains(name, { timeout: 10000 }).should('be.visible');
});
