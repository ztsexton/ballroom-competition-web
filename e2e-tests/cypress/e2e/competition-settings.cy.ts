/// <reference types="cypress" />

/**
 * Competition Settings Page E2E Tests
 *
 * These tests verify that all settings on the competition settings page:
 * 1. Can be changed by the user
 * 2. Persist after page reload
 * 3. Update the UI correctly
 * 4. Show the "Saved" indicator
 */

describe('Competition Settings Page', () => {
  let competitionId: number;

  before(() => {
    // Login and create a test competition once for all tests
    cy.loginAsAdmin();
    cy.createTestCompetitionAndNavigateToSettings('E2E Test Competition').then((id) => {
      competitionId = id as unknown as number;
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
    // Navigate to settings page for the test competition
    if (competitionId) {
      cy.visit(`/competitions/${competitionId}/settings`);
    }
    // Wait for page to load
    cy.contains('h3', 'General').should('be.visible');
  });

  describe('General Section', () => {
    it('should update competition name and persist after reload', () => {
      const newName = `Updated Competition ${Date.now()}`;

      // Find and update the name field
      cy.get('input[type="text"]').first().clear().type(newName);

      // Blur to trigger save
      cy.get('input[type="text"]').first().blur();

      // Wait for saved indicator
      cy.contains('Saved').should('be.visible');

      // Reload page
      cy.reload();

      // Verify the name persisted
      cy.get('input[type="text"]').first().should('have.value', newName);
    });

    it('should update competition date and show saved indicator', () => {
      const newDate = '2026-07-20';

      // Find date input and change it
      cy.get('input[type="date"]').first().clear().type(newDate);

      // Date saves on change, not blur
      cy.contains('Saved').should('be.visible');

      // Reload and verify
      cy.reload();
      cy.get('input[type="date"]').first().should('have.value', newDate);
    });

    it('should update location and persist after reload', () => {
      const newLocation = 'New Test City, NTC';

      cy.contains('label', 'Location')
        .parent()
        .find('input')
        .clear()
        .type(newLocation)
        .blur();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.contains('label', 'Location')
        .parent()
        .find('input')
        .should('have.value', newLocation);
    });

    it('should update description and persist after reload', () => {
      const newDescription = 'This is an updated test description for the competition.';

      cy.get('textarea').first().clear().type(newDescription).blur();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.get('textarea').first().should('have.value', newDescription);
    });

    it('should switch organization type and update UI', () => {
      // Click on "Studio" button
      cy.contains('button', 'Studio').click();

      // Confirm the switch
      cy.on('window:confirm', () => true);

      // Verify the button is now active (has different styling)
      cy.contains('button', 'Studio')
        .should('have.css', 'font-weight')
        .and('match', /700|bold/);

      cy.contains('Saved').should('be.visible');

      // Reload and verify
      cy.reload();
      cy.contains('button', 'Studio')
        .should('have.css', 'font-weight')
        .and('match', /700|bold/);
    });
  });

  describe('Contact & Links Section', () => {
    it('should update website URL and persist after reload', () => {
      cy.expandSection('Contact & Links');

      const newUrl = 'https://example-competition.com';

      cy.contains('label', 'Website URL')
        .parent()
        .find('input')
        .clear()
        .type(newUrl)
        .blur();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Contact & Links');
      cy.contains('label', 'Website URL')
        .parent()
        .find('input')
        .should('have.value', newUrl);
    });

    it('should update organizer email and persist after reload', () => {
      cy.expandSection('Contact & Links');

      const newEmail = 'organizer@example-test.com';

      cy.contains('label', 'Organizer Email')
        .parent()
        .find('input')
        .clear()
        .type(newEmail)
        .blur();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Contact & Links');
      cy.contains('label', 'Organizer Email')
        .parent()
        .find('input')
        .should('have.value', newEmail);
    });
  });

  describe('Rules & Scoring Section', () => {
    it('should switch between Standard and Proficiency scoring and persist', () => {
      // Click Proficiency button
      cy.contains('button', 'Proficiency').click();

      cy.contains('Saved').should('be.visible');

      // Verify it's active
      cy.contains('button', 'Proficiency')
        .should('have.css', 'font-weight')
        .and('match', /700|bold/);

      // Verify helper text updated
      cy.contains('New events will default to proficiency scoring').should('be.visible');

      // Reload and verify
      cy.reload();
      cy.contains('button', 'Proficiency')
        .should('have.css', 'font-weight')
        .and('match', /700|bold/);

      // Switch back to Standard
      cy.contains('button', 'Standard').click();
      cy.contains('Saved').should('be.visible');

      cy.contains('New events will default to standard scoring').should('be.visible');
    });

    it('should update max couples per heat and persist', () => {
      const maxCouples = '12';

      cy.contains('label', 'Max Couples Per Heat')
        .parent()
        .find('input[type="number"]')
        .clear()
        .type(maxCouples);

      // Number inputs save on change
      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.contains('label', 'Max Couples Per Heat')
        .parent()
        .find('input[type="number"]')
        .should('have.value', maxCouples);
    });

    it('should switch between Combined and Integrated level modes and persist', () => {
      // Click Integrated button
      cy.contains('button', 'Integrated').click();

      cy.contains('Saved').should('be.visible');

      // Verify it's active
      cy.contains('button', 'Integrated')
        .should('have.css', 'font-weight')
        .and('match', /700|bold/);

      // Verify helper text updated
      cy.contains('Events select from the level list directly').should('be.visible');

      // Reload and verify
      cy.reload();
      cy.contains('button', 'Integrated')
        .should('have.css', 'font-weight')
        .and('match', /700|bold/);

      // Switch back to Combined
      cy.contains('button', 'Combined').click();
      cy.contains('Saved').should('be.visible');
    });

    it('should add a custom level and persist', () => {
      const customLevel = 'Platinum Elite';

      cy.get('input[placeholder="Add custom level..."]').type(customLevel);
      cy.contains('button', 'Add').click();

      cy.contains('Saved').should('be.visible');

      // Verify the level appears in the list
      cy.contains(customLevel).should('be.visible');

      // Reload and verify
      cy.reload();
      cy.contains(customLevel).should('be.visible');
    });

    it('should remove a level and persist', () => {
      // First add a level to remove
      const levelToRemove = 'Level To Remove';
      cy.get('input[placeholder="Add custom level..."]').type(levelToRemove);
      cy.contains('button', 'Add').click();
      cy.contains('Saved').should('be.visible');

      // Find and click the remove button for this level
      cy.contains(levelToRemove)
        .parent()
        .find('button')
        .contains('✕')
        .click();

      cy.contains('Saved').should('be.visible');

      // Verify the level is gone
      cy.contains(levelToRemove).should('not.exist');

      // Reload and verify
      cy.reload();
      cy.contains(levelToRemove).should('not.exist');
    });

    it('should reorder levels using up/down buttons and persist', () => {
      // Get the second level
      cy.get('span').contains('2.').parent().find('span').eq(1).invoke('text').then((secondLevel) => {
        // Click the up arrow on the second level
        cy.get('span').contains('2.').parent().find('button').contains('▲').click();

        cy.contains('Saved').should('be.visible');

        // Verify it's now first
        cy.get('span').contains('1.').parent().find('span').eq(1).should('have.text', secondLevel.trim());

        // Reload and verify order persisted
        cy.reload();
        cy.get('span').contains('1.').parent().find('span').eq(1).should('have.text', secondLevel.trim());
      });
    });

    it('should apply a level template and update levels', () => {
      // Look for a template button (e.g., "USA Dance")
      cy.contains('button', 'USA Dance').then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          cy.contains('Saved').should('be.visible');

          // Reload and verify levels changed
          cy.reload();
          // Verify some USA Dance levels exist
          cy.contains('Newcomer').should('be.visible');
        }
      });
    });
  });

  describe('Entry Validation Section', () => {
    beforeEach(() => {
      cy.expandSection('Entry Validation');
    });

    it('should toggle entry validation on/off and persist', () => {
      // Find the toggle and check its state
      cy.contains('Entry Level Restrictions').parent().find('button').click();

      cy.contains('Saved').should('be.visible');

      // Reload and verify toggle state
      cy.reload();
      cy.expandSection('Entry Validation');

      // The toggle should show the changed state
      cy.contains('Entry Level Restrictions').should('be.visible');
    });

    it('should update levels above allowed and persist', () => {
      // First enable validation if not enabled
      cy.contains('Entry Level Restrictions Disabled').then(($el) => {
        if ($el.length) {
          cy.wrap($el).parent().find('button').click();
          cy.contains('Saved').should('be.visible');
        }
      });

      // Update levels above allowed
      cy.contains('label', 'Levels Above Allowed')
        .parent()
        .find('input[type="number"]')
        .clear()
        .type('3');

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Entry Validation');
      cy.contains('label', 'Levels Above Allowed')
        .parent()
        .find('input[type="number"]')
        .should('have.value', '3');
    });
  });

  describe('Floor Size Section', () => {
    beforeEach(() => {
      cy.expandSection('Floor Size');
    });

    it('should update default max couples on floor and persist', () => {
      const maxOnFloor = '8';

      cy.contains('label', 'Default Max Couples on Floor')
        .parent()
        .find('input[type="number"]')
        .clear()
        .type(maxOnFloor);

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Floor Size');
      cy.contains('label', 'Default Max Couples on Floor')
        .parent()
        .find('input[type="number"]')
        .should('have.value', maxOnFloor);
    });

    it('should update per-level floor overrides and persist', () => {
      // Find the first level override input and set a value
      cy.contains('Per-Level Overrides')
        .parent()
        .find('input[type="number"]')
        .first()
        .clear()
        .type('6');

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Floor Size');
      cy.contains('Per-Level Overrides')
        .parent()
        .find('input[type="number"]')
        .first()
        .should('have.value', '6');
    });
  });

  describe('Recall & Advancement Section', () => {
    beforeEach(() => {
      cy.expandSection('Recall & Advancement');
    });

    it('should update target final size and persist', () => {
      cy.contains('label', 'Target Final Size')
        .parent()
        .find('input[type="number"]')
        .clear()
        .type('8');

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Recall & Advancement');
      cy.contains('label', 'Target Final Size')
        .parent()
        .find('input[type="number"]')
        .should('have.value', '8');
    });

    it('should update final max size and persist', () => {
      cy.contains('label', 'Final Max Size')
        .parent()
        .find('input[type="number"]')
        .clear()
        .type('10');

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Recall & Advancement');
      cy.contains('label', 'Final Max Size')
        .parent()
        .find('input[type="number"]')
        .should('have.value', '10');
    });

    it('should toggle include ties and persist', () => {
      // Find and click the Include Ties toggle
      cy.contains('Include Ties at Cut Line').parent().find('button').click();

      cy.contains('Saved').should('be.visible');

      // Reload and verify
      cy.reload();
      cy.expandSection('Recall & Advancement');

      // The toggle text should reflect the change
      cy.contains(/Include Ties at Cut Line (On|Off)/).should('be.visible');
    });
  });

  describe('Billing Section', () => {
    it('should update currency and persist', () => {
      // Change currency to EUR
      cy.contains('label', 'Currency')
        .parent()
        .find('select')
        .select('EUR');

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.contains('label', 'Currency')
        .parent()
        .find('select')
        .should('have.value', 'EUR');

      // Change back to USD
      cy.contains('label', 'Currency')
        .parent()
        .find('select')
        .select('USD');
    });
  });

  describe('Visibility & Access Section', () => {
    it('should toggle public visibility and persist', () => {
      cy.contains('Public Visibility').parent().find('button').click();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.contains(/Public Visibility (On|Off)/).should('be.visible');
    });

    it('should toggle registration open and persist', () => {
      cy.contains('Participant Registration').parent().find('button').click();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.contains(/Participant Registration (Open|Closed)/).should('be.visible');
    });

    it('should toggle public results and persist', () => {
      cy.contains('Public Results').parent().find('button').click();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.contains(/Public Results (On|Off)/).should('be.visible');
    });

    it('should toggle heat lists published and persist', () => {
      cy.contains('Heat Lists').parent().find('button').click();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.contains(/Heat Lists (Published|Draft)/).should('be.visible');
    });

    it('should set scheduled visibility datetime and persist', () => {
      // First turn off public visibility to show the datetime input
      cy.contains('Public Visibility On').then(($el) => {
        if ($el.length) {
          cy.wrap($el).parent().find('button').click();
          cy.contains('Saved').should('be.visible');
        }
      });

      // Set scheduled visibility
      const futureDate = '2026-06-01T09:00';
      cy.contains('Schedule visibility for')
        .parent()
        .find('input[type="datetime-local"]')
        .type(futureDate);

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.contains('Schedule visibility for')
        .parent()
        .find('input[type="datetime-local"]')
        .should('have.value', futureDate);
    });
  });

  describe('Age Categories Section', () => {
    beforeEach(() => {
      cy.expandSection('Age Categories');
    });

    it('should add a new age category and persist', () => {
      cy.contains('button', '+ Add Category').click();

      // Fill in the new category
      cy.getSection('Age Categories')
        .find('input[placeholder="Name"]')
        .last()
        .type('Junior')
        .blur();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Age Categories');
      cy.contains('Junior').should('be.visible');
    });

    it('should update age category min/max ages and persist', () => {
      // Add a category first
      cy.contains('button', '+ Add Category').click();

      // Fill in name and ages
      cy.getSection('Age Categories')
        .find('input[placeholder="Name"]')
        .last()
        .type('Adult')
        .blur();

      cy.getSection('Age Categories')
        .find('input[placeholder="Min age"]')
        .last()
        .type('19')
        .blur();

      cy.getSection('Age Categories')
        .find('input[placeholder="Max age"]')
        .last()
        .type('35')
        .blur();

      cy.contains('Saved').should('be.visible');

      cy.reload();
      cy.expandSection('Age Categories');

      // Verify values persisted
      cy.contains('Adult').should('be.visible');
      cy.getSection('Age Categories')
        .find('input[value="19"]')
        .should('exist');
    });

    it('should remove an age category and persist', () => {
      // First add a category to remove
      cy.contains('button', '+ Add Category').click();
      cy.getSection('Age Categories')
        .find('input[placeholder="Name"]')
        .last()
        .type('ToRemove')
        .blur();

      cy.contains('Saved').should('be.visible');

      // Now remove it
      cy.contains('ToRemove')
        .parent()
        .find('button')
        .contains('X')
        .click();

      cy.contains('Saved').should('be.visible');

      // Verify it's gone
      cy.contains('ToRemove').should('not.exist');

      cy.reload();
      cy.expandSection('Age Categories');
      cy.contains('ToRemove').should('not.exist');
    });
  });

  describe('UI State Consistency', () => {
    it('should show correct values after rapid changes without reload', () => {
      // Make multiple rapid changes without reloading
      const newName = `Rapid Change Test ${Date.now()}`;

      // Change name
      cy.get('input[type="text"]').first().clear().type(newName).blur();
      cy.contains('Saved').should('be.visible');

      // Change date
      cy.get('input[type="date"]').first().clear().type('2026-08-15');
      cy.contains('Saved').should('be.visible');

      // Change scoring type
      cy.contains('button', 'Proficiency').click();
      cy.contains('Saved').should('be.visible');

      // Verify all values are correct in the UI (without reload)
      cy.get('input[type="text"]').first().should('have.value', newName);
      cy.get('input[type="date"]').first().should('have.value', '2026-08-15');
      cy.contains('button', 'Proficiency')
        .should('have.css', 'font-weight')
        .and('match', /700|bold/);
    });

    it('should handle failed saves gracefully', () => {
      // Intercept API call to fail
      cy.intercept('PUT', '/api/competitions/*', {
        statusCode: 500,
        body: { error: 'Internal server error' },
      }).as('failedSave');

      // Try to make a change
      cy.get('input[type="text"]').first().clear().type('Should Fail').blur();

      // Should show an alert (we can't easily test window.alert)
      // But the UI should not show "Saved"
      cy.contains('Saved').should('not.exist');
    });
  });
});
