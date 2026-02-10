/// <reference types="cypress" />

describe('Smoke Test', () => {
  it('should login via Firebase Auth Emulator and see the dashboard', () => {
    // Visit login page to initialize Firebase
    cy.visit('/login');

    // Wait for Firebase to initialize and expose __testLogin
    cy.window().its('__testLogin').should('exist');

    // Sign in programmatically via the emulator
    cy.window().invoke(
      '__testLogin',
      Cypress.env('TEST_USER_EMAIL'),
      Cypress.env('TEST_USER_PASSWORD'),
    );

    // LoginPage should redirect to /dashboard after auth
    cy.url().should('include', '/dashboard', { timeout: 15000 });

    // Dashboard should show the main heading
    cy.contains('Ballroom Scorer').should('be.visible');

    // Should show the "+ New Competition" link
    cy.contains('New Competition').should('be.visible');
  });

  it('should create a competition', () => {
    cy.visit('/login');
    cy.window().its('__testLogin').should('exist');
    cy.window().invoke(
      '__testLogin',
      Cypress.env('TEST_USER_EMAIL'),
      Cypress.env('TEST_USER_PASSWORD'),
    );
    cy.url().should('include', '/dashboard', { timeout: 15000 });

    // Navigate to competitions page
    cy.contains('a', 'New Competition').click();
    cy.url().should('include', '/competitions');

    // Click the "+ New Competition" button to show form
    cy.contains('button', 'New Competition').click();

    // Fill in the form
    cy.contains('Create New Competition').should('be.visible');
    cy.get('input[placeholder*="Spring Championship"]').clear().type('Smoke Test Competition');
    cy.get('input[type="date"]').first().clear().type('2026-08-15');

    // Submit
    cy.contains('button', 'Create Competition').click();

    // Competition should appear in the list
    cy.contains('Smoke Test Competition', { timeout: 10000 }).should('be.visible');
  });
});
