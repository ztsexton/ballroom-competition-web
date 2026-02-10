/// <reference types="cypress" />

/**
 * Scoring and Results E2E Tests
 *
 * Tests for entering scores and viewing results.
 * This is the core functionality used during competition day.
 */

describe('Scoring and Results', () => {
  let competitionId: number;

  before(() => {
    cy.loginAsAdmin();
    cy.createTestCompetitionAndNavigateToSettings('Scoring Test Comp').then((id) => {
      competitionId = id as unknown as number;
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('Scrutineer Scoring Interface', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/scrutineer`);
    });

    it('should display scrutineer page', () => {
      cy.contains(/scrutineer|scoring|judge/i).should('be.visible');
    });

    it('should show event and round selector', () => {
      cy.get('select[name="event"], [data-testid="event-select"]').should('be.visible');
      cy.get('select[name="round"], [data-testid="round-select"]').should('be.visible');
    });

    it('should display scoring grid with judges and couples', () => {
      // Select an event
      cy.get('select[name="event"]').select(1);
      cy.get('select[name="round"]').select(1);

      // Should show grid
      cy.get('[data-testid="scoring-grid"], table').should('be.visible');
    });

    it('should enter recall marks for recall round', () => {
      cy.get('select[name="event"]').select(1);
      cy.get('select[name="round"]').contains(/semi|quarter/i).then(($option) => {
        if ($option.length) {
          cy.get('select[name="round"]').select($option.val() as string);

          // Click on cells to mark recalls
          cy.get('[data-testid="score-cell"]').first().click();

          // Cell should be marked
          cy.get('[data-testid="score-cell"]').first().should('have.class', 'recalled');
        }
      });
    });

    it('should enter rankings for final round', () => {
      cy.get('select[name="event"]').select(1);
      cy.get('select[name="round"]').contains(/final/i).then(($option) => {
        if ($option.length) {
          cy.get('select[name="round"]').select($option.val() as string);

          // Enter ranking
          cy.get('[data-testid="score-cell"]').first().type('1');

          // Should accept the ranking
          cy.get('[data-testid="score-cell"]').first().should('have.value', '1');
        }
      });
    });

    it('should validate ranking input (no duplicates for same judge)', () => {
      cy.get('select[name="event"]').select(1);
      cy.get('select[name="round"]').contains(/final/i).then(($option) => {
        if ($option.length) {
          cy.get('select[name="round"]').select($option.val() as string);

          // Enter same ranking twice for same judge
          cy.get('[data-testid="score-cell"][data-judge="1"]').eq(0).type('1');
          cy.get('[data-testid="score-cell"][data-judge="1"]').eq(1).type('1');

          // Should show error
          cy.contains(/duplicate|invalid|error/i).should('be.visible');
        }
      });
    });

    it('should compile scores after all judges submit', () => {
      cy.get('select[name="event"]').select(1);
      cy.get('select[name="round"]').select(1);

      cy.contains(/compile|calculate|finalize/i).click();

      // Should show results or success message
      cy.contains(/compiled|result|success/i).should('be.visible');
    });
  });

  describe('Judge Scoring Interface', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/judge-scoring`);
    });

    it('should display judge scoring page', () => {
      cy.contains(/judge|scoring/i).should('be.visible');
    });

    it('should show judge selection', () => {
      cy.get('select[name="judge"], [data-testid="judge-select"]').should('be.visible');
    });

    it('should show current heat information', () => {
      cy.contains(/heat|current|now dancing/i).should('be.visible');
    });

    it('should display bib numbers for couples', () => {
      cy.contains(/bib|#\d/i).should('be.visible');
    });

    it('should allow quick recall marking', () => {
      // Click on a bib to recall
      cy.get('[data-testid="bib-button"], .bib-card').first().click();

      // Should be marked as recalled
      cy.get('[data-testid="bib-button"]').first().should('have.class', 'recalled');
    });

    it('should allow tap-to-rank scoring', () => {
      // Tap bibs in order for ranking
      cy.get('[data-testid="bib-button"]').eq(0).click(); // 1st place
      cy.get('[data-testid="bib-button"]').eq(1).click(); // 2nd place
      cy.get('[data-testid="bib-button"]').eq(2).click(); // 3rd place

      // Should show rankings
      cy.contains('1st').should('be.visible');
      cy.contains('2nd').should('be.visible');
      cy.contains('3rd').should('be.visible');
    });

    it('should submit scores', () => {
      // Mark all couples
      cy.get('[data-testid="bib-button"]').each(($bib) => {
        cy.wrap($bib).click();
      });

      cy.contains(/submit|save/i).click();

      cy.contains(/submitted|saved|success/i).should('be.visible');
    });

    it('should show scoring progress', () => {
      cy.contains(/\d+.*of.*\d+|progress|remaining/i).should('be.visible');
    });
  });

  describe('Results Display', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/events`);
    });

    it('should show results button for completed rounds', () => {
      cy.get('[data-testid="event-item"]').first().then(($event) => {
        if ($event.find('button:contains("Results")').length) {
          cy.wrap($event).find('button:contains("Results")').should('be.visible');
        }
      });
    });

    it('should display results with placements', () => {
      cy.get('[data-testid="event-item"]').first().find('button:contains("Results")').click();

      // Should show placements
      cy.contains(/1st|first|place/i).should('be.visible');
    });

    it('should show skating method breakdown', () => {
      cy.get('[data-testid="event-item"]').first().find('button:contains("Results")').click();

      // Should show skating columns
      cy.contains(/majority|skating/i).should('be.visible');
    });

    it('should show recalled couples for recall rounds', () => {
      // Find a recall round results
      cy.contains(/semi|quarter/i).parent().find('button:contains("Results")').then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          cy.contains(/recalled|advanced/i).should('be.visible');
        }
      });
    });
  });

  describe('Proficiency Scoring', () => {
    it('should enter proficiency scores (0-100)', () => {
      // Find a proficiency event
      cy.visit(`/competitions/${competitionId}/scrutineer`);

      cy.get('select[name="event"]').find('option').contains(/proficiency/i).then(($option) => {
        if ($option.length) {
          cy.get('select[name="event"]').select($option.val() as string);

          // Enter proficiency score
          cy.get('[data-testid="score-input"]').first().type('85');

          cy.get('[data-testid="score-input"]').first().should('have.value', '85');
        }
      });
    });

    it('should validate proficiency score range', () => {
      cy.visit(`/competitions/${competitionId}/scrutineer`);

      cy.get('[data-testid="score-input"]').first().type('150'); // Invalid score

      cy.contains(/invalid|must be|0.*100/i).should('be.visible');
    });
  });

  describe('Multi-Dance Scoring', () => {
    it('should score each dance separately', () => {
      cy.visit(`/competitions/${competitionId}/scrutineer`);

      // Find multi-dance event
      cy.get('select[name="event"]').find('option').then(($options) => {
        // Select multi-dance event if exists
        cy.get('select[name="event"]').select(1);

        // Should show dance tabs or selector
        cy.contains(/waltz|tango|foxtrot|dance/i).should('be.visible');
      });
    });

    it('should aggregate multi-dance scores for placement', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      // Find multi-dance event results
      cy.get('[data-testid="event-item"]').contains(/multi|3-dance|5-dance/i).parent().find('button:contains("Results")').then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          cy.contains(/aggregate|total|combined/i).should('be.visible');
        }
      });
    });
  });

  describe('Score Editing', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/scrutineer`);
    });

    it('should allow editing previously entered scores', () => {
      cy.get('select[name="event"]').select(1);
      cy.get('select[name="round"]').select(1);

      // Edit a score
      cy.get('[data-testid="score-cell"]').first().clear().type('2');

      cy.contains('Saved').should('be.visible');
    });

    it('should track score edit history', () => {
      cy.contains(/history|audit|changes/i).then(($el) => {
        if ($el.length) {
          cy.wrap($el).click();
          cy.contains(/changed|edited|modified/i).should('be.visible');
        }
      });
    });
  });

  describe('Score Clearing', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/scrutineer`);
    });

    it('should clear all scores for a round with confirmation', () => {
      cy.get('select[name="event"]').select(1);
      cy.get('select[name="round"]').select(1);

      cy.contains(/clear.*scores|reset/i).click();

      cy.on('window:confirm', () => true);

      // Scores should be cleared
      cy.get('[data-testid="score-cell"]').first().should('have.value', '');
    });
  });

  describe('Real-time Updates', () => {
    it('should show live scoring progress during competition', () => {
      cy.visit(`/competitions/${competitionId}/run`);

      // Should show current heat status
      cy.contains(/current|now|live/i).should('be.visible');

      // Should show which judges have submitted
      cy.contains(/judge.*\d|submitted/i).should('be.visible');
    });
  });
});
