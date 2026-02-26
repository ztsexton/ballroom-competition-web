/// <reference types="cypress" />

describe('Competition Creation and Home Page Display', () => {
  beforeEach(() => {
    cy.loginWithEmulator();
  });

  it('should create a new competition and see it on the home page', () => {
    const competitionName = `E2E Test Comp ${Date.now()}`;
    const competitionDate = '2026-09-20';

    // Navigate to competitions page from the dashboard
    cy.contains('a', 'New Competition').click();
    cy.url().should('include', '/competitions');

    // Open the new competition form
    cy.contains('button', 'New Competition').click();
    cy.contains('Create New Competition').should('be.visible');

    // Fill in the competition details
    cy.get('input[placeholder*="Spring Championship"]').clear().type(competitionName);
    cy.get('input[type="date"]').first().clear().type(competitionDate);

    // Submit the form
    cy.contains('button', 'Create Competition').click();

    // Verify competition appears in the competitions list
    cy.contains(competitionName, { timeout: 10000 }).should('be.visible');

    // Navigate to the home/dashboard page
    cy.visit('/dashboard');

    // The competition should appear on the home page
    cy.contains(competitionName, { timeout: 10000 }).should('be.visible');

    // Verify the competition entry is a clickable link
    cy.contains('a', competitionName).should('exist');
  });

  it('should show competition details on the home page after creation', () => {
    const competitionName = `Detail Check ${Date.now()}`;
    const competitionDate = '2026-11-10';

    // Use the helper to create a competition
    cy.visit('/dashboard');
    cy.contains('a', 'New Competition').click();
    cy.url().should('include', '/competitions');

    cy.contains('button', 'New Competition').click();
    cy.get('input[placeholder*="Spring Championship"]').clear().type(competitionName);
    cy.get('input[type="date"]').first().clear().type(competitionDate);

    // Set a location
    cy.get('input[placeholder*="City"]').clear().type('New York, NY');

    cy.contains('button', 'Create Competition').click();
    cy.contains(competitionName, { timeout: 10000 }).should('be.visible');

    // Go to dashboard and verify details
    cy.visit('/dashboard');
    cy.contains(competitionName, { timeout: 10000 }).should('be.visible');
    cy.contains('New York, NY').should('be.visible');

    // Verify the competition count header updates
    cy.get('h3').contains('Competitions').should('be.visible');
  });
});
