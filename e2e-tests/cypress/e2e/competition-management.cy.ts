/// <reference types="cypress" />

/**
 * Competition Management E2E Tests
 *
 * Tests the full lifecycle of competition management:
 * - Creating competitions
 * - Viewing competition details
 * - Editing competition info
 * - Deleting competitions
 * - Competition list and search
 */

describe('Competition Management', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('Competition List', () => {
    it('should display list of competitions on home page', () => {
      cy.visit('/');

      // Should show competitions section
      cy.contains(/competition/i).should('be.visible');
    });

    it('should show empty state when no competitions exist', () => {
      // Intercept to return empty list
      cy.intercept('GET', '/api/competitions', {
        statusCode: 200,
        body: [],
      }).as('emptyCompetitions');

      cy.visit('/');
      cy.wait('@emptyCompetitions');

      cy.contains(/no competition|create.*first|get started/i).should('be.visible');
    });

    it('should filter competitions by search query', () => {
      cy.visit('/');

      // Type in search box
      cy.get('input[placeholder*="Search"]').type('Galaxy');

      // Should filter results
      cy.contains('Galaxy').should('be.visible');
    });

    it('should sort competitions by date (most recent first)', () => {
      cy.visit('/');

      // Get all competition dates and verify sorting
      cy.get('[data-testid="competition-item"], .card a').then(($items) => {
        if ($items.length > 1) {
          // Verify order is descending by date
          const dates = $items.map((_, el) => {
            const dateText = Cypress.$(el).text();
            const dateMatch = dateText.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
            return dateMatch ? new Date(dateMatch[0]).getTime() : 0;
          }).get();

          for (let i = 0; i < dates.length - 1; i++) {
            expect(dates[i]).to.be.at.least(dates[i + 1]);
          }
        }
      });
    });
  });

  describe('Create Competition', () => {
    it('should navigate to create competition page', () => {
      cy.visit('/');

      cy.contains(/new competition|\+ create/i).click();

      cy.url().should('include', '/competitions');
    });

    it('should create a new competition with required fields', () => {
      const compName = `Test Competition ${Date.now()}`;

      cy.visit('/competitions');

      // Fill in the form
      cy.get('input[name="name"], input[placeholder*="name" i]').first().type(compName);
      cy.get('input[type="date"]').first().type('2026-08-15');
      cy.get('input[name="location"], input[placeholder*="location" i]').first().type('Test City, TS');

      // Submit
      cy.contains('button', /create|save|submit/i).click();

      // Should redirect to competition details
      cy.url().should('match', /\/competitions\/\d+/);

      // Verify competition was created
      cy.contains(compName).should('be.visible');
    });

    it('should validate required fields before submission', () => {
      cy.visit('/competitions');

      // Try to submit without filling required fields
      cy.contains('button', /create|save|submit/i).click();

      // Should show validation error or prevent submission
      cy.url().should('include', '/competitions');
    });

    it('should show competition type selection', () => {
      cy.visit('/competitions');

      // Should show type options
      cy.contains(/NDCA|USA Dance|WDC|WDSF|Studio|Unaffiliated/i).should('be.visible');
    });
  });

  describe('Competition Details', () => {
    let testCompetitionId: number;

    before(() => {
      // Create a test competition
      cy.loginAsAdmin();
      cy.request({
        method: 'POST',
        url: '/api/competitions',
        body: {
          name: 'E2E Details Test Competition',
          date: '2026-09-01',
          location: 'Details Test City',
          type: 'STUDIO',
        },
        headers: {
          Authorization: 'Bearer mock-test-token',
        },
      }).then((response) => {
        testCompetitionId = response.body.id;
      });
    });

    it('should display competition details page', () => {
      cy.visit(`/competitions/${testCompetitionId}`);

      cy.contains('E2E Details Test Competition').should('be.visible');
      cy.contains('Details Test City').should('be.visible');
    });

    it('should show navigation tabs for competition sections', () => {
      cy.visit(`/competitions/${testCompetitionId}`);

      // Should have navigation to different sections
      const expectedTabs = ['Details', 'Events', 'People', 'Couples', 'Judges', 'Schedule', 'Settings'];

      expectedTabs.forEach((tab) => {
        cy.contains(new RegExp(tab, 'i')).should('exist');
      });
    });

    it('should navigate between competition sections', () => {
      cy.visit(`/competitions/${testCompetitionId}`);

      // Click on Events tab
      cy.contains(/events/i).click();
      cy.url().should('include', '/events');

      // Click on People tab
      cy.contains(/people|participants/i).click();
      cy.url().should('include', '/people');

      // Click on Settings tab
      cy.contains(/settings/i).click();
      cy.url().should('include', '/settings');
    });

    it('should show quick stats/summary on details page', () => {
      cy.visit(`/competitions/${testCompetitionId}`);

      // Should show counts or stats
      cy.contains(/event|participant|couple|entr/i).should('be.visible');
    });
  });

  describe('Delete Competition', () => {
    it('should show delete confirmation before deleting', () => {
      cy.visit('/');

      // Find a competition and try to delete
      cy.get('[data-testid="delete-competition"], button:contains("Delete")').first().then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();

          // Should show confirmation dialog
          cy.contains(/are you sure|confirm|delete/i).should('be.visible');

          // Cancel the deletion
          cy.contains(/cancel|no/i).click();
        }
      });
    });

    it('should delete competition after confirmation', () => {
      // First create a competition to delete
      const compName = `To Delete ${Date.now()}`;

      cy.visit('/competitions');
      cy.get('input[name="name"], input[placeholder*="name" i]').first().type(compName);
      cy.get('input[type="date"]').first().type('2026-12-31');
      cy.contains('button', /create|save/i).click();

      // Go back to list
      cy.visit('/');

      // Find and delete
      cy.contains(compName).parent().find('button:contains("Delete")').click();

      // Confirm
      cy.on('window:confirm', () => true);

      // Competition should be removed
      cy.contains(compName).should('not.exist');
    });
  });

  describe('Competition Switching', () => {
    it('should remember active competition across page navigation', () => {
      cy.visit('/');

      // Click on a competition
      cy.get('[data-testid="competition-item"], .card a').first().click();

      // Navigate to events
      cy.contains(/events/i).click();

      // Navigate back to home
      cy.visit('/');

      // The previously selected competition should still be active
      cy.window().then((win) => {
        expect(win.localStorage.getItem('activeCompetitionId')).to.not.be.null;
      });
    });
  });
});
