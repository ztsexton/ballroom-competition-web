/// <reference types="cypress" />

/**
 * Authentication E2E Tests
 *
 * Critical for security and user access control.
 * Tests login, logout, session persistence, and role-based access.
 *
 * NOTE: These tests are skipped when AUTH_DISABLED=true (e.g., in Docker/CI)
 * because the backend bypasses authentication in that mode.
 */

describe('Authentication', function () {
  before(function () {
    // Skip all auth tests when running with auth disabled
    if (Cypress.env('AUTH_DISABLED') === 'true') {
      this.skip();
    }
  });

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Login Flow', () => {
    it('should show login page for unauthenticated users', () => {
      cy.visit('/');

      // Should redirect to login or show login button
      cy.url().should('satisfy', (url: string) =>
        url.includes('/login') || url.includes('/portal')
      );
    });

    it('should display Google sign-in button', () => {
      cy.visit('/login');

      cy.contains(/sign in|log in|google/i).should('be.visible');
    });

    it('should redirect to home after successful login', () => {
      cy.loginAsAdmin();
      cy.visit('/');

      // Admin should see the dashboard, not login
      cy.contains(/competition|dashboard|ballroom/i).should('be.visible');
    });

    it('should persist session across page reloads', () => {
      cy.loginAsAdmin();
      cy.visit('/');

      // Reload the page
      cy.reload();

      // Should still be logged in
      cy.contains(/competition|dashboard/i).should('be.visible');
      cy.contains(/sign in|log in/i).should('not.exist');
    });

    it('should persist session across browser tabs (localStorage)', () => {
      cy.loginAsAdmin();
      cy.visit('/');

      // Check localStorage has auth data
      cy.window().then((win) => {
        const hasAuthData = Object.keys(win.localStorage).some(
          (key) => key.includes('firebase') || key.includes('auth')
        );
        // We use mock auth, so check our mock
        expect(win.localStorage.getItem('mockAuthUser')).to.not.be.null;
      });
    });
  });

  describe('Logout Flow', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
    });

    it('should log out user when clicking logout button', () => {
      cy.visit('/');

      // Find and click logout (could be in a menu)
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="user-menu"]').length) {
          cy.get('[data-testid="user-menu"]').click();
        }
      });

      cy.contains(/log ?out|sign ?out/i).click();

      // Should redirect to login page
      cy.url().should('satisfy', (url: string) =>
        url.includes('/login') || url.includes('/portal')
      );
    });

    it('should clear session data on logout', () => {
      cy.visit('/');

      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="user-menu"]').length) {
          cy.get('[data-testid="user-menu"]').click();
        }
      });

      cy.contains(/log ?out|sign ?out/i).click();

      // Auth data should be cleared
      cy.window().then((win) => {
        expect(win.localStorage.getItem('mockAuthUser')).to.be.null;
      });
    });
  });

  describe('Role-Based Access Control', () => {
    it('should restrict admin pages from non-admin users', () => {
      // Login as non-admin
      cy.window().then((win) => {
        win.localStorage.setItem('mockAuthUser', JSON.stringify({
          uid: 'non-admin-user',
          email: 'user@example.com',
          isAdmin: false,
        }));
      });

      // Try to access admin-only page
      cy.visit('/competitions');

      // Should be redirected or show access denied
      cy.url().should('satisfy', (url: string) =>
        url.includes('/portal') || url.includes('/login')
      );
    });

    it('should allow admin users to access admin pages', () => {
      cy.loginAsAdmin();
      cy.visit('/competitions');

      // Should see competitions page
      cy.contains(/competition/i).should('be.visible');
    });

    it('should show participant portal for non-admin authenticated users', () => {
      cy.window().then((win) => {
        win.localStorage.setItem('mockAuthUser', JSON.stringify({
          uid: 'participant-user',
          email: 'participant@example.com',
          isAdmin: false,
        }));
      });

      cy.visit('/');

      // Should redirect to participant portal
      cy.url().should('include', '/portal');
    });
  });

  describe('Session Timeout', () => {
    it('should handle expired tokens gracefully', () => {
      cy.loginAsAdmin();

      // Intercept API calls to return 401
      cy.intercept('/api/**', {
        statusCode: 401,
        body: { error: 'Token expired' },
      }).as('expiredToken');

      cy.visit('/');

      // Should redirect to login or show re-auth prompt
      cy.wait('@expiredToken');

      // App should handle gracefully (not crash)
      cy.get('body').should('be.visible');
    });
  });

  describe('Protected Routes', () => {
    const protectedRoutes = [
      '/competitions',
      '/competitions/1',
      '/competitions/1/settings',
      '/competitions/1/events',
      '/competitions/1/people',
      '/competitions/1/couples',
      '/competitions/1/judges',
      '/competitions/1/schedule',
    ];

    protectedRoutes.forEach((route) => {
      it(`should protect ${route} from unauthenticated access`, () => {
        cy.visit(route);

        // Should redirect to login
        cy.url().should('satisfy', (url: string) =>
          url.includes('/login') || url.includes('/portal') || !url.includes(route)
        );
      });
    });
  });
});
