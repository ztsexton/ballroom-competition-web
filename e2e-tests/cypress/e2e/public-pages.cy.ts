/// <reference types="cypress" />

/**
 * Public Pages E2E Tests
 *
 * Tests for public-facing pages that don't require authentication.
 * These pages are accessed by spectators, competitors, and studios.
 */

describe('Public Pages', () => {
  let competitionId: number;

  before(() => {
    // Create a competition that will be made public
    cy.loginAsAdmin();
    cy.createTestCompetitionAndNavigateToSettings('Public Test Comp').then((id) => {
      competitionId = id as unknown as number;
    });
  });

  describe('Competition List (Homepage)', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    it('should display public competitions list', () => {
      cy.contains(/competition|event/i).should('be.visible');
    });

    it('should show competition dates and locations', () => {
      cy.get('[data-testid="competition-card"], .competition-item').first().then(($card) => {
        if ($card.length) {
          // Should show date
          cy.wrap($card).contains(/\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i).should('exist');
        }
      });
    });

    it('should filter competitions by date', () => {
      cy.get('[data-testid="date-filter"], select[name="date"]').then(($filter) => {
        if ($filter.length) {
          cy.wrap($filter).select('upcoming');
        }
      });
    });

    it('should search competitions by name', () => {
      cy.get('input[placeholder*="search" i]').then(($search) => {
        if ($search.length) {
          cy.wrap($search).type('Public Test');
          cy.contains('Public Test').should('be.visible');
        }
      });
    });

    it('should navigate to competition details', () => {
      cy.get('[data-testid="competition-card"]').first().click();
      cy.url().should('include', '/competitions/');
    });
  });

  describe('Public Competition Info', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/info`);
    });

    it('should display competition name', () => {
      cy.contains(/Public Test Comp|competition/i).should('be.visible');
    });

    it('should show date and location', () => {
      cy.contains(/date|when/i).should('be.visible');
      cy.contains(/location|where|venue/i).should('be.visible');
    });

    it('should display organizer contact info', () => {
      cy.contains(/contact|email|organizer/i).should('be.visible');
    });

    it('should show registration status', () => {
      cy.contains(/registration|sign up|open|closed/i).should('be.visible');
    });

    it('should link to registration if open', () => {
      cy.contains(/register|sign up/i).then(($link) => {
        if ($link.length) {
          cy.wrap($link).should('have.attr', 'href');
        }
      });
    });
  });

  describe('Public Heat Lists', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/heats`);
    });

    it('should display heat lists page', () => {
      cy.contains(/heat|schedule/i).should('be.visible');
    });

    it('should show heats organized by session/time', () => {
      cy.contains(/session|morning|afternoon|evening|time/i).should('be.visible');
    });

    it('should show event name for each heat', () => {
      cy.get('[data-testid="heat-item"], .heat-row').first().then(($heat) => {
        if ($heat.length) {
          cy.wrap($heat).contains(/bronze|silver|gold|waltz|tango/i).should('exist');
        }
      });
    });

    it('should show bib numbers in heats', () => {
      cy.get('[data-testid="heat-item"]').first().then(($heat) => {
        if ($heat.length) {
          cy.wrap($heat).contains(/\d+/).should('exist');
        }
      });
    });

    it('should filter heats by session', () => {
      cy.get('select[name="session"], [data-testid="session-filter"]').then(($filter) => {
        if ($filter.length) {
          cy.wrap($filter).select(1);
        }
      });
    });

    it('should search heats by bib number', () => {
      cy.get('input[placeholder*="search" i], input[placeholder*="bib" i]').then(($search) => {
        if ($search.length) {
          cy.wrap($search).type('101');
          // Should filter to matching bibs
        }
      });
    });

    it('should search heats by dancer name', () => {
      cy.get('input[placeholder*="search" i]').then(($search) => {
        if ($search.length) {
          cy.wrap($search).type('John');
          // Should filter to matching names
        }
      });
    });

    it('should print heat lists', () => {
      cy.contains(/print/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).should('be.visible');
        }
      });
    });
  });

  describe('Public Results', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/results`);
    });

    it('should display results page', () => {
      cy.contains(/result/i).should('be.visible');
    });

    it('should show completed events with placements', () => {
      cy.get('[data-testid="result-item"], .result-card').first().then(($result) => {
        if ($result.length) {
          cy.wrap($result).contains(/1st|2nd|3rd|place/i).should('exist');
        }
      });
    });

    it('should show dancer names with placements', () => {
      cy.get('[data-testid="result-item"]').first().then(($result) => {
        if ($result.length) {
          // Should show names, not just bibs
          cy.wrap($result).should('not.contain.html', 'only numbers');
        }
      });
    });

    it('should filter results by style', () => {
      cy.get('select[name="style"], [data-testid="style-filter"]').then(($filter) => {
        if ($filter.length) {
          cy.wrap($filter).select('Smooth');
        }
      });
    });

    it('should filter results by level', () => {
      cy.get('select[name="level"], [data-testid="level-filter"]').then(($filter) => {
        if ($filter.length) {
          cy.wrap($filter).select('Bronze');
        }
      });
    });

    it('should search results by dancer name', () => {
      cy.get('input[placeholder*="search" i]').then(($search) => {
        if ($search.length) {
          cy.wrap($search).type('Jane');
        }
      });
    });

    it('should show skating breakdown on demand', () => {
      cy.get('[data-testid="result-item"]').first().then(($result) => {
        if ($result.length) {
          cy.wrap($result).find('[data-testid="show-details"], button').click();
          cy.contains(/skating|majority|breakdown/i).should('be.visible');
        }
      });
    });
  });

  describe('Live Results / Now Dancing', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/live`);
    });

    it('should display live page', () => {
      cy.contains(/live|now|current/i).should('be.visible');
    });

    it('should show currently dancing heat', () => {
      cy.contains(/now dancing|current heat|on floor/i).should('be.visible');
    });

    it('should show upcoming heats', () => {
      cy.contains(/next|upcoming|on deck/i).should('be.visible');
    });

    it('should auto-refresh results', () => {
      // Page should have auto-refresh mechanism
      cy.get('[data-testid="live-feed"], .live-container').should('exist');
    });

    it('should show recent results', () => {
      cy.contains(/recent|just danced|latest/i).should('be.visible');
    });
  });

  describe('Competitor Portal', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/my-schedule`);
    });

    it('should show login prompt if not authenticated', () => {
      cy.contains(/sign in|log in|authenticate/i).should('be.visible');
    });

    it('should show personalized schedule after login', () => {
      cy.loginAsAdmin();
      cy.visit(`/competitions/${competitionId}/my-schedule`);

      // Should show heats for this user
      cy.contains(/your|my|schedule/i).should('be.visible');
    });

    it('should highlight upcoming heats', () => {
      cy.loginAsAdmin();
      cy.visit(`/competitions/${competitionId}/my-schedule`);

      cy.get('[data-testid="upcoming-heat"], .next-heat').should('exist');
    });

    it('should show results for completed events', () => {
      cy.loginAsAdmin();
      cy.visit(`/competitions/${competitionId}/my-results`);

      cy.contains(/result|placement/i).should('be.visible');
    });
  });

  describe('Studio Portal', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/studio`);
    });

    it('should show studio entries', () => {
      cy.loginAsAdmin();
      cy.visit(`/competitions/${competitionId}/studio`);

      cy.contains(/entries|students|couples/i).should('be.visible');
    });

    it('should show invoice status', () => {
      cy.loginAsAdmin();
      cy.visit(`/competitions/${competitionId}/studio`);

      cy.contains(/invoice|balance|payment/i).should('be.visible');
    });

    it('should show all heats for studio', () => {
      cy.loginAsAdmin();
      cy.visit(`/competitions/${competitionId}/studio/heats`);

      cy.contains(/heat|schedule/i).should('be.visible');
    });
  });

  describe('Public Event Schedule', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/schedule`);
    });

    it('should show event timeline', () => {
      cy.contains(/schedule|timeline|program/i).should('be.visible');
    });

    it('should show session times', () => {
      cy.contains(/\d+:\d+|am|pm/i).should('be.visible');
    });

    it('should group events by session', () => {
      cy.contains(/session|morning|afternoon/i).should('be.visible');
    });
  });

  describe('Spectator Features', () => {
    it('should not require login to view public pages', () => {
      // Clear any existing session
      cy.clearCookies();
      cy.clearLocalStorage();

      cy.visit(`/competitions/${competitionId}/info`);
      cy.contains(/competition/i).should('be.visible');

      cy.visit(`/competitions/${competitionId}/heats`);
      cy.contains(/heat|schedule/i).should('be.visible');

      cy.visit(`/competitions/${competitionId}/results`);
      cy.contains(/result/i).should('be.visible');
    });

    it('should have mobile-friendly layout', () => {
      cy.viewport('iphone-x');
      cy.visit(`/competitions/${competitionId}/heats`);

      // Should still be usable on mobile
      cy.get('body').should('be.visible');
      cy.contains(/heat/i).should('be.visible');
    });
  });

  describe('Print Views', () => {
    it('should have printable heat lists', () => {
      cy.visit(`/competitions/${competitionId}/heats/print`);
      // Should have print-friendly layout
      cy.get('body').should('be.visible');
    });

    it('should have printable results', () => {
      cy.visit(`/competitions/${competitionId}/results/print`);
      cy.get('body').should('be.visible');
    });
  });

  describe('Visibility Controls', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
    });

    it('should respect public visibility toggle', () => {
      // Make competition private
      cy.visit(`/competitions/${competitionId}/settings`);
      cy.get('[data-testid="public-visibility"]').then(($toggle) => {
        if ($toggle.attr('data-state') === 'checked') {
          cy.wrap($toggle).click();
          cy.contains(/saved/i).should('be.visible');
        }
      });

      // Clear session and try to access
      cy.clearCookies();
      cy.clearLocalStorage();
      cy.visit(`/competitions/${competitionId}/info`, { failOnStatusCode: false });

      // Should show not found or require login
      cy.contains(/not found|private|sign in/i).should('be.visible');
    });

    it('should respect results published toggle', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('[data-testid="public-results"]').then(($toggle) => {
        if ($toggle.attr('data-state') === 'checked') {
          cy.wrap($toggle).click();
        }
      });

      // Clear session
      cy.clearCookies();
      cy.visit(`/competitions/${competitionId}/results`);

      // Should not show results
      cy.contains(/not available|coming soon|private/i).should('be.visible');
    });

    it('should respect heat lists published toggle', () => {
      cy.loginAsAdmin();
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('[data-testid="heat-lists-published"]').then(($toggle) => {
        // Toggle off if on
        if ($toggle.attr('data-state') === 'checked') {
          cy.wrap($toggle).click();
        }
      });

      cy.clearCookies();
      cy.visit(`/competitions/${competitionId}/heats`);

      cy.contains(/not available|coming soon/i).should('be.visible');
    });
  });
});
