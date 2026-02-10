/// <reference types="cypress" />

/**
 * Error Handling and Edge Cases E2E Tests
 *
 * Tests for graceful error handling, validation, and edge cases.
 * Critical for maintaining a robust user experience.
 */

describe('Error Handling and Edge Cases', () => {
  let competitionId: number;

  before(() => {
    cy.loginAsAdmin();
    cy.createTestCompetitionAndNavigateToSettings('Error Test Comp').then((id) => {
      competitionId = id as unknown as number;
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('Network Errors', () => {
    it('should handle API timeout gracefully', () => {
      cy.intercept('/api/**', { forceNetworkError: true }).as('networkError');

      cy.visit(`/competitions/${competitionId}/events`);

      // Should show error message, not crash
      cy.contains(/error|failed|try again|unable/i).should('be.visible');
    });

    it('should show retry option on network failure', () => {
      cy.intercept('/api/competitions/*', { forceNetworkError: true }).as('networkError');

      cy.visit(`/competitions/${competitionId}/settings`);

      cy.contains(/retry|try again|reload/i).should('be.visible');
    });

    it('should recover after network restored', () => {
      let requestCount = 0;

      cy.intercept('/api/competitions/*', (req) => {
        requestCount++;
        if (requestCount === 1) {
          req.destroy();
        } else {
          req.continue();
        }
      }).as('apiCall');

      cy.visit(`/competitions/${competitionId}/settings`);

      // Click retry
      cy.contains(/retry|try again/i).click();

      // Should eventually load
      cy.contains(/settings|competition/i).should('be.visible');
    });

    it('should handle 500 server errors', () => {
      cy.intercept('/api/competitions/*', {
        statusCode: 500,
        body: { error: 'Internal server error' },
      }).as('serverError');

      cy.visit(`/competitions/${competitionId}/settings`);

      cy.contains(/error|something went wrong|server/i).should('be.visible');
    });

    it('should handle 503 service unavailable', () => {
      cy.intercept('/api/**', {
        statusCode: 503,
        body: { error: 'Service unavailable' },
      }).as('serviceUnavailable');

      cy.visit(`/competitions/${competitionId}/events`);

      cy.contains(/unavailable|maintenance|try later/i).should('be.visible');
    });
  });

  describe('Authentication Errors', () => {
    it('should redirect to login on 401 unauthorized', () => {
      cy.intercept('/api/**', {
        statusCode: 401,
        body: { error: 'Unauthorized' },
      }).as('unauthorized');

      cy.visit(`/competitions/${competitionId}/settings`);

      // Should redirect to login or show auth error
      cy.url().should('include', '/login');
    });

    it('should show error on 403 forbidden', () => {
      cy.intercept('/api/competitions/*/settings', {
        statusCode: 403,
        body: { error: 'Access denied' },
      }).as('forbidden');

      cy.visit(`/competitions/${competitionId}/settings`);

      cy.contains(/access denied|permission|forbidden/i).should('be.visible');
    });

    it('should handle expired session', () => {
      cy.intercept('/api/**', {
        statusCode: 401,
        body: { error: 'Session expired' },
      }).as('sessionExpired');

      cy.visit(`/competitions/${competitionId}/settings`);

      cy.contains(/session expired|sign in again|login/i).should('be.visible');
    });
  });

  describe('Validation Errors', () => {
    it('should show validation errors on form submit', () => {
      cy.visit(`/competitions/${competitionId}/people`);

      // Try to add person without required fields
      cy.contains(/add|new|create/i).click();

      cy.contains('button', /save|add|create/i).click();

      // Should show validation errors
      cy.contains(/required|invalid|enter/i).should('be.visible');
    });

    it('should highlight invalid fields', () => {
      cy.visit(`/competitions/${competitionId}/people`);
      cy.contains(/add|new/i).click();

      // Submit empty form
      cy.contains('button', /save/i).click();

      // Fields should have error styling
      cy.get('input:invalid, [aria-invalid="true"], .error').should('exist');
    });

    it('should validate email format', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('input[name="organizerEmail"]').clear().type('not-an-email');
      cy.contains('button', /save/i).click();

      cy.contains(/invalid email|valid email/i).should('be.visible');
    });

    it('should validate URL format', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('input[name="websiteUrl"]').clear().type('not-a-url');
      cy.contains('button', /save/i).click();

      cy.contains(/invalid.*url|valid.*url/i).should('be.visible');
    });

    it('should validate date format', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      // If there's a text date input
      cy.get('input[name="date"]').then(($input) => {
        if ($input.attr('type') === 'text') {
          cy.wrap($input).clear().type('invalid-date');
          cy.contains('button', /save/i).click();
          cy.contains(/invalid date/i).should('be.visible');
        }
      });
    });

    it('should validate number ranges', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('input[name="maxCouplesPerHeat"]').clear().type('-5');
      cy.contains('button', /save/i).click();

      cy.contains(/must be.*positive|greater than|invalid/i).should('be.visible');
    });

    it('should prevent duplicate bib numbers', () => {
      cy.visit(`/competitions/${competitionId}/couples`);
      cy.contains(/add|new/i).click();

      // Try to use existing bib
      cy.get('input[name="bib"]').type('101');
      cy.contains('button', /save/i).click();

      // If 101 exists, should show error
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="couple-101"]').length) {
          cy.contains(/duplicate|already|exists/i).should('be.visible');
        }
      });
    });
  });

  describe('Not Found Errors', () => {
    it('should show 404 for non-existent competition', () => {
      cy.visit('/competitions/99999', { failOnStatusCode: false });

      cy.contains(/not found|doesn't exist|404/i).should('be.visible');
    });

    it('should show 404 for non-existent event', () => {
      cy.visit(`/competitions/${competitionId}/events/99999`, { failOnStatusCode: false });

      cy.contains(/not found|doesn't exist/i).should('be.visible');
    });

    it('should show 404 for invalid routes', () => {
      cy.visit('/this-page-does-not-exist', { failOnStatusCode: false });

      cy.contains(/not found|page doesn't exist|404/i).should('be.visible');
    });

    it('should provide navigation back from 404', () => {
      cy.visit('/nonexistent-page', { failOnStatusCode: false });

      cy.contains(/home|back|return/i).should('be.visible');
    });
  });

  describe('Empty States', () => {
    it('should show empty state for no events', () => {
      // Visit events page on fresh competition
      cy.visit(`/competitions/${competitionId}/events`);

      // Should show empty state or create prompt
      cy.contains(/no events|create.*first|get started/i).should('be.visible');
    });

    it('should show empty state for no people', () => {
      cy.visit(`/competitions/${competitionId}/people`);

      cy.contains(/no people|add.*first|get started/i).should('be.visible');
    });

    it('should show empty state for no results', () => {
      cy.visit(`/competitions/${competitionId}/results`);

      cy.contains(/no results|not.*scored|pending/i).should('be.visible');
    });

    it('should show call-to-action in empty states', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      // Should have a button to create first item
      cy.contains(/add|create|get started/i).should('be.visible');
    });
  });

  describe('Concurrent Editing', () => {
    it('should handle stale data conflicts', () => {
      // Simulate another user updating the same resource
      cy.intercept('PATCH', '/api/competitions/*', {
        statusCode: 409,
        body: { error: 'Conflict: Data was modified by another user' },
      }).as('conflict');

      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('input[name="name"]').clear().type('Updated Name');
      cy.contains('button', /save/i).click();

      cy.contains(/conflict|modified|refresh/i).should('be.visible');
    });

    it('should provide refresh option on conflict', () => {
      cy.intercept('PATCH', '/api/competitions/*', {
        statusCode: 409,
        body: { error: 'Conflict' },
      }).as('conflict');

      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('input[name="name"]').type(' changed');
      cy.contains('button', /save/i).click();

      cy.contains(/refresh|reload|try again/i).should('be.visible');
    });
  });

  describe('Long Running Operations', () => {
    it('should show loading state for slow operations', () => {
      cy.intercept('/api/**', (req) => {
        req.on('response', (res) => {
          res.setDelay(2000);
        });
      }).as('slowRequest');

      cy.visit(`/competitions/${competitionId}/events`);

      // Should show loading indicator
      cy.get('[data-testid="loading"], .loading, .spinner').should('be.visible');
    });

    it('should not allow double-submit during save', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('input[name="name"]').type(' test');

      // Click save
      cy.contains('button', /save/i).as('saveBtn').click();

      // Button should be disabled during save
      cy.get('@saveBtn').should('be.disabled');
    });

    it('should show progress for batch operations', () => {
      cy.visit(`/competitions/${competitionId}/invoices`);

      cy.contains(/generate all|batch/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          // Should show progress
          cy.contains(/processing|generating|progress/i).should('be.visible');
        }
      });
    });
  });

  describe('Data Integrity', () => {
    it('should confirm before deleting', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      cy.get('[data-testid="event-item"]').first().then(($item) => {
        if ($item.length) {
          cy.wrap($item).find('button:contains("Delete")').click();

          // Should ask for confirmation
          cy.contains(/confirm|sure|delete/i).should('be.visible');
        }
      });
    });

    it('should prevent deleting items with dependencies', () => {
      cy.visit(`/competitions/${competitionId}/judges`);

      // Try to delete a judge that's assigned to events
      cy.get('[data-testid="judge-item"]').first().find('button:contains("Delete")').then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          cy.on('window:confirm', () => true);

          // Should warn about dependencies
          cy.contains(/assigned|in use|cannot delete/i).should('be.visible');
        }
      });
    });

    it('should warn about unsaved changes on navigation', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      // Make a change
      cy.get('input[name="name"]').type(' unsaved');

      // Try to navigate away
      cy.get('nav a').first().click();

      // Should warn about unsaved changes
      cy.contains(/unsaved|discard|leave/i).should('be.visible');
    });
  });

  describe('Input Sanitization', () => {
    it('should escape HTML in text inputs', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('input[name="name"]').clear().type('<script>alert("xss")</script>');
      cy.contains('button', /save/i).click();

      // Should not execute script, should escape it
      cy.get('body').should('not.contain.html', '<script>');
    });

    it('should handle special characters in names', () => {
      cy.visit(`/competitions/${competitionId}/people`);
      cy.contains(/add|new/i).click();

      cy.get('input[name="firstName"]').type("O'Brien");
      cy.get('input[name="lastName"]').type('José María');

      cy.contains('button', /save|add/i).click();

      // Should save and display correctly
      cy.contains("O'Brien").should('be.visible');
    });

    it('should handle very long input', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      const longText = 'A'.repeat(1000);
      cy.get('input[name="name"]').clear().type(longText);
      cy.contains('button', /save/i).click();

      // Should either truncate or show error
      cy.contains(/too long|maximum|limit|saved/i).should('be.visible');
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle zero entries in event', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      // Create event with no entries
      cy.contains(/add|new|create/i).click();
      cy.get('input[name="name"]').type('Empty Event');
      cy.contains('button', /create|save/i).click();

      // Should handle gracefully
      cy.contains('Empty Event').should('be.visible');
    });

    it('should handle single entry in final', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      // Event with 1 entry should still work
      cy.get('[data-testid="event-item"]').contains(/1 entr/i).then(($item) => {
        if ($item.length) {
          cy.wrap($item).click();
          // Should show appropriate message
          cy.contains(/final|winner|entry/i).should('be.visible');
        }
      });
    });

    it('should handle maximum couples in heat', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      // Try to set unreasonably high number
      cy.get('input[name="maxCouplesPerHeat"]').clear().type('100');
      cy.contains('button', /save/i).click();

      // Should warn or cap the value
      cy.contains(/maximum|warning|too many/i).should('be.visible');
    });
  });

  describe('Browser Edge Cases', () => {
    it('should handle browser back button', () => {
      cy.visit(`/competitions/${competitionId}/events`);
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.go('back');

      cy.url().should('include', '/events');
    });

    it('should handle page refresh', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      // Change something
      cy.get('input[name="name"]').type(' refresh test');
      cy.contains('button', /save/i).click();
      cy.contains(/saved/i).should('be.visible');

      // Refresh
      cy.reload();

      // Data should persist
      cy.get('input[name="name"]').should('contain.value', 'refresh test');
    });

    it('should work offline then sync', () => {
      // This is a placeholder for offline support testing
      // Real implementation would need service worker testing
    });
  });

  describe('Accessibility During Errors', () => {
    it('should announce errors to screen readers', () => {
      cy.visit(`/competitions/${competitionId}/settings`);

      cy.get('input[name="organizerEmail"]').clear().type('invalid');
      cy.contains('button', /save/i).click();

      // Error should have aria attributes
      cy.get('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').should('exist');
    });

    it('should focus on first error field', () => {
      cy.visit(`/competitions/${competitionId}/people`);
      cy.contains(/add|new/i).click();

      // Submit empty form
      cy.contains('button', /save/i).click();

      // First invalid field should be focused
      cy.get('input:invalid').first().should('have.focus');
    });
  });
});
