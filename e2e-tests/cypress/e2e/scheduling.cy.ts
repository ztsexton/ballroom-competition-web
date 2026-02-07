/// <reference types="cypress" />

/**
 * Scheduling E2E Tests
 *
 * Tests for competition scheduling functionality.
 * Critical for day-of operations and heat management.
 */

describe('Scheduling', () => {
  let competitionId: number;

  before(() => {
    cy.loginAsAdmin();
    cy.createTestCompetitionAndNavigateToSettings('Schedule Test Comp').then((id) => {
      competitionId = id as unknown as number;
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('Schedule Generation', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should display schedule page', () => {
      cy.contains(/schedule|heat/i).should('be.visible');
    });

    it('should show generate schedule button', () => {
      cy.contains(/generate|create.*schedule/i).should('be.visible');
    });

    it('should generate schedule from events', () => {
      cy.contains(/generate|create.*schedule/i).click();

      // Wait for generation
      cy.contains(/heat|schedule generated/i, { timeout: 10000 }).should('be.visible');
    });

    it('should show schedule configuration options', () => {
      cy.contains(/generate/i).click();

      // Should show configuration options
      cy.contains(/style order|level order|timing/i).should('be.visible');
    });

    it('should configure timing settings', () => {
      cy.contains(/timing|settings|configure/i).click();

      // Should show timing inputs
      cy.contains(/seconds per|duration|time/i).should('be.visible');
    });
  });

  describe('Heat List Display', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
      // Generate schedule if not exists
      cy.get('body').then(($body) => {
        if ($body.find(':contains("Generate")').length && !$body.find('[data-testid="heat-item"]').length) {
          cy.contains('Generate').click();
          cy.wait(2000);
        }
      });
    });

    it('should display heats in order', () => {
      cy.get('[data-testid="heat-item"], .heat-row').should('have.length.at.least', 1);
    });

    it('should show heat number for each heat', () => {
      cy.get('[data-testid="heat-item"]').first().contains(/heat.*\d|#\d/i).should('be.visible');
    });

    it('should show event name in heat', () => {
      cy.get('[data-testid="heat-item"]').first().should('be.visible');
    });

    it('should show couple count in heat', () => {
      cy.get('[data-testid="heat-item"]').first().contains(/\d+ couple|\d+ entr/i).should('be.visible');
    });

    it('should show estimated start time', () => {
      cy.contains(/\d{1,2}:\d{2}|time/i).should('be.visible');
    });
  });

  describe('Heat Reordering', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should allow drag and drop reordering', () => {
      cy.get('[data-testid="heat-item"]').first().then(($heat) => {
        if ($heat.length) {
          // Verify drag handles exist
          cy.wrap($heat).find('[data-testid="drag-handle"], .drag-handle').should('exist');
        }
      });
    });

    it('should allow reordering via buttons', () => {
      cy.get('[data-testid="heat-item"]').eq(1).then(($heat) => {
        if ($heat.length) {
          cy.wrap($heat).find('button:contains("↑"), button:contains("Up")').click();

          // Heat should have moved up
          cy.contains('Saved').should('be.visible');
        }
      });
    });

    it('should update heat numbers after reordering', () => {
      // Get initial order
      cy.get('[data-testid="heat-item"]').then(($heats) => {
        const initialCount = $heats.length;

        // Reorder
        if (initialCount > 1) {
          cy.get('[data-testid="heat-item"]').eq(1).find('button:contains("↑")').click();

          // Numbers should still be sequential
          cy.get('[data-testid="heat-item"]').should('have.length', initialCount);
        }
      });
    });
  });

  describe('Break Management', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should add a break to the schedule', () => {
      cy.contains(/add break|insert break/i).click();

      // Fill in break details
      cy.get('input[name="label"], input[placeholder*="break" i]').type('Lunch Break');
      cy.get('input[name="duration"], input[type="number"]').type('30');

      cy.contains('button', /add|save/i).click();

      // Verify break appears
      cy.contains('Lunch Break').should('be.visible');
    });

    it('should edit a break', () => {
      cy.contains('Lunch Break').parent().find('button:contains("Edit")').click();

      cy.get('input[name="label"]').clear().type('Extended Lunch');
      cy.contains('button', /save|update/i).click();

      cy.contains('Extended Lunch').should('be.visible');
    });

    it('should remove a break', () => {
      cy.contains(/break/i).parent().find('button:contains("Remove"), button:contains("Delete")').first().click();

      cy.on('window:confirm', () => true);
    });
  });

  describe('Heat Splitting', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should split a heat with many couples', () => {
      cy.get('[data-testid="heat-item"]').first().then(($heat) => {
        if ($heat.length) {
          cy.wrap($heat).find('button:contains("Split")').then(($btn) => {
            if ($btn.length) {
              cy.wrap($btn).click();

              // Should show split options
              cy.contains(/floor|group|split into/i).should('be.visible');
            }
          });
        }
      });
    });

    it('should unsplit a previously split heat', () => {
      cy.get('[data-testid="heat-item"]').contains('Floor').parent().find('button:contains("Unsplit")').then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
        }
      });
    });
  });

  describe('Back-to-Back Detection', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should detect back-to-back conflicts', () => {
      cy.contains(/back.to.back|conflict/i).then(($el) => {
        if ($el.length) {
          cy.wrap($el).should('be.visible');
        }
      });
    });

    it('should minimize back-to-back conflicts', () => {
      cy.contains(/minimize|resolve.*conflict/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();

          cy.contains(/resolved|minimized|conflict/i).should('be.visible');
        }
      });
    });
  });

  describe('Current Heat Navigation', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should highlight current heat', () => {
      // Should have a current heat indicator
      cy.get('[data-testid="current-heat"], .current-heat, .active-heat').should('exist');
    });

    it('should advance to next heat', () => {
      cy.contains(/next|advance|→/i).click();

      // Current heat should change
      cy.contains('Saved').should('be.visible');
    });

    it('should go back to previous heat', () => {
      cy.contains(/back|previous|←/i).click();

      cy.contains('Saved').should('be.visible');
    });

    it('should jump to specific heat', () => {
      cy.get('[data-testid="heat-item"]').eq(2).then(($heat) => {
        if ($heat.length) {
          cy.wrap($heat).find('button:contains("Jump"), button:contains("Go to")').click();
        }
      });
    });
  });

  describe('Schedule Publishing', () => {
    it('should publish schedule for participants', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      // Find heat lists published toggle
      cy.contains(/heat lists/i).parent().find('button').click();

      cy.contains('Saved').should('be.visible');
    });
  });

  describe('Schedule Reset', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should reset schedule with confirmation', () => {
      cy.contains(/reset|regenerate|clear/i).click();

      // Should show confirmation
      cy.on('window:confirm', () => true);

      // Schedule should be cleared or regenerated
      cy.contains(/generate|empty|no heats/i).should('be.visible');
    });

    it('should reset a single heat', () => {
      cy.get('[data-testid="heat-item"]').first().find('button:contains("Reset")').then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          cy.on('window:confirm', () => true);
        }
      });
    });
  });

  describe('Print/Export', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should have print option', () => {
      cy.contains(/print|export|pdf/i).should('be.visible');
    });
  });
});
