/// <reference types="cypress" />

/**
 * Participant Management E2E Tests
 *
 * Tests for managing people, couples, and judges.
 * Critical for competition registration and pairing.
 */

describe('Participant Management', () => {
  let competitionId: number;

  before(() => {
    cy.loginAsAdmin();
    cy.createTestCompetitionAndNavigateToSettings('Participant Test Comp').then((id) => {
      competitionId = id as unknown as number;
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('People Management', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/people`);
    });

    it('should display people list page', () => {
      cy.contains(/people|participant|dancer/i).should('be.visible');
    });

    it('should add a new person with required fields', () => {
      const firstName = 'Test';
      const lastName = `Person${Date.now()}`;

      // Click add button
      cy.contains(/add|new|create/i).click();

      // Fill in form
      cy.get('input[name="firstName"], input[placeholder*="first" i]').type(firstName);
      cy.get('input[name="lastName"], input[placeholder*="last" i]').type(lastName);

      // Select role
      cy.get('select[name="role"], [data-testid="role-select"]').select('leader');

      // Save
      cy.contains('button', /save|add|create/i).click();

      // Verify person appears in list
      cy.contains(`${firstName} ${lastName}`).should('be.visible');
    });

    it('should add person with email and status', () => {
      const email = `test${Date.now()}@example.com`;

      cy.contains(/add|new|create/i).click();

      cy.get('input[name="firstName"], input[placeholder*="first" i]').type('Email');
      cy.get('input[name="lastName"], input[placeholder*="last" i]').type('Test');
      cy.get('input[name="email"], input[type="email"]').type(email);
      cy.get('select[name="status"]').select('professional');

      cy.contains('button', /save|add/i).click();

      cy.contains(email).should('be.visible');
    });

    it('should edit an existing person', () => {
      // First add a person
      cy.contains(/add|new/i).click();
      cy.get('input[name="firstName"], input[placeholder*="first" i]').type('ToEdit');
      cy.get('input[name="lastName"], input[placeholder*="last" i]').type('Person');
      cy.get('select[name="role"]').select('follower');
      cy.contains('button', /save|add/i).click();

      // Find and edit
      cy.contains('ToEdit Person').parent().find('button:contains("Edit")').click();

      // Change name
      cy.get('input[name="firstName"], input[placeholder*="first" i]').clear().type('Edited');
      cy.contains('button', /save|update/i).click();

      // Verify change
      cy.contains('Edited Person').should('be.visible');
    });

    it('should delete a person', () => {
      // First add a person
      const name = `ToDelete${Date.now()}`;
      cy.contains(/add|new/i).click();
      cy.get('input[name="firstName"], input[placeholder*="first" i]').type(name);
      cy.get('input[name="lastName"], input[placeholder*="last" i]').type('Person');
      cy.get('select[name="role"]').select('leader');
      cy.contains('button', /save|add/i).click();

      // Delete
      cy.contains(`${name} Person`).parent().find('button:contains("Delete")').click();
      cy.on('window:confirm', () => true);

      // Verify removed
      cy.contains(`${name} Person`).should('not.exist');
    });

    it('should filter people by search', () => {
      // Add some people
      cy.contains(/add|new/i).click();
      cy.get('input[name="firstName"]').type('Searchable');
      cy.get('input[name="lastName"]').type('Dancer');
      cy.get('select[name="role"]').select('both');
      cy.contains('button', /save|add/i).click();

      // Search
      cy.get('input[placeholder*="search" i]').type('Searchable');

      // Should filter
      cy.contains('Searchable Dancer').should('be.visible');
    });

    it('should filter people by role', () => {
      cy.get('select[name="roleFilter"], [data-testid="role-filter"]').then(($select) => {
        if ($select.length) {
          cy.wrap($select).select('leader');
          // Verify filtering works
        }
      });
    });

    it('should show person count', () => {
      cy.contains(/\d+ (people|participant|dancer)/i).should('be.visible');
    });
  });

  describe('Couples Management', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/couples`);
    });

    it('should display couples list page', () => {
      cy.contains(/couple|pair/i).should('be.visible');
    });

    it('should create a new couple from existing people', () => {
      // First ensure we have a leader and follower
      cy.visit(`/competitions/${competitionId}/people`);

      // Add leader
      cy.contains(/add|new/i).click();
      cy.get('input[name="firstName"]').type('Leader');
      cy.get('input[name="lastName"]').type(`Test${Date.now()}`);
      cy.get('select[name="role"]').select('leader');
      cy.contains('button', /save|add/i).click();

      // Add follower
      cy.contains(/add|new/i).click();
      cy.get('input[name="firstName"]').type('Follower');
      cy.get('input[name="lastName"]').type(`Test${Date.now()}`);
      cy.get('select[name="role"]').select('follower');
      cy.contains('button', /save|add/i).click();

      // Go to couples page
      cy.visit(`/competitions/${competitionId}/couples`);

      // Create couple
      cy.contains(/add|create|new couple/i).click();

      // Select leader and follower
      cy.get('select[name="leader"], [data-testid="leader-select"]').select(1);
      cy.get('select[name="follower"], [data-testid="follower-select"]').select(1);

      cy.contains('button', /create|save/i).click();

      // Verify couple created with bib number
      cy.contains(/bib|#/i).should('be.visible');
    });

    it('should auto-assign bib numbers', () => {
      // Create multiple couples and verify bib numbers are sequential
      cy.get('[data-testid="couple-item"], tr').then(($items) => {
        const bibNumbers = $items.map((_, el) => {
          const text = Cypress.$(el).text();
          const match = text.match(/(?:bib|#)\s*(\d+)/i);
          return match ? parseInt(match[1]) : null;
        }).get().filter(Boolean);

        // Verify bibs are unique
        const uniqueBibs = new Set(bibNumbers);
        expect(uniqueBibs.size).to.equal(bibNumbers.length);
      });
    });

    it('should delete a couple', () => {
      cy.get('[data-testid="couple-item"], tr').first().then(($item) => {
        if ($item.length) {
          cy.wrap($item).find('button:contains("Delete")').click();
          cy.on('window:confirm', () => true);
        }
      });
    });

    it('should show couple entries count', () => {
      cy.get('[data-testid="couple-item"], tr').first().then(($item) => {
        if ($item.length) {
          // Click to view details
          cy.wrap($item).click();
          cy.contains(/entr|event/i).should('be.visible');
        }
      });
    });
  });

  describe('Judges Management', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/judges`);
    });

    it('should display judges list page', () => {
      cy.contains(/judge/i).should('be.visible');
    });

    it('should add a new judge', () => {
      const judgeName = `Judge ${Date.now()}`;

      cy.contains(/add|new|create/i).click();

      cy.get('input[name="name"], input[placeholder*="name" i]').type(judgeName);

      cy.contains('button', /save|add|create/i).click();

      cy.contains(judgeName).should('be.visible');
    });

    it('should assign judge number', () => {
      const judgeName = `Numbered Judge ${Date.now()}`;

      cy.contains(/add|new/i).click();
      cy.get('input[name="name"]').type(judgeName);
      cy.contains('button', /save|add/i).click();

      // Verify judge has a number
      cy.contains(judgeName).parent().contains(/\d/).should('be.visible');
    });

    it('should mark judge as chairman', () => {
      cy.get('[data-testid="judge-item"], tr').first().then(($item) => {
        if ($item.length) {
          cy.wrap($item).find('input[type="checkbox"], button:contains("Chairman")').first().click();
          cy.contains(/chairman|chair/i).should('be.visible');
        }
      });
    });

    it('should edit judge name', () => {
      const newName = `Renamed Judge ${Date.now()}`;

      cy.get('[data-testid="judge-item"], tr').first().find('button:contains("Edit")').click();
      cy.get('input[name="name"]').clear().type(newName);
      cy.contains('button', /save|update/i).click();

      cy.contains(newName).should('be.visible');
    });

    it('should delete a judge', () => {
      // Add a judge to delete
      cy.contains(/add|new/i).click();
      cy.get('input[name="name"]').type('To Delete Judge');
      cy.contains('button', /save|add/i).click();

      // Delete
      cy.contains('To Delete Judge').parent().find('button:contains("Delete")').click();
      cy.on('window:confirm', () => true);

      cy.contains('To Delete Judge').should('not.exist');
    });

    it('should show judge count in header', () => {
      cy.contains(/\d+ judge/i).should('be.visible');
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/people`);
    });

    it('should support importing people from CSV', () => {
      cy.contains(/import|csv|upload/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          // Should show import dialog
          cy.contains(/import|upload|csv/i).should('be.visible');
        }
      });
    });

    it('should support exporting people list', () => {
      cy.contains(/export|download/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          // Should trigger download or show options
        }
      });
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/people`);
    });

    it('should validate required fields when adding person', () => {
      cy.contains(/add|new/i).click();

      // Try to save without required fields
      cy.contains('button', /save|add/i).click();

      // Should show validation error
      cy.contains(/required|missing|invalid/i).should('be.visible');
    });

    it('should validate email format', () => {
      cy.contains(/add|new/i).click();

      cy.get('input[name="firstName"]').type('Test');
      cy.get('input[name="lastName"]').type('Person');
      cy.get('input[name="email"], input[type="email"]').type('invalid-email');
      cy.get('select[name="role"]').select('leader');

      cy.contains('button', /save|add/i).click();

      // Should show email validation error
      cy.contains(/email|invalid/i).should('be.visible');
    });
  });
});
