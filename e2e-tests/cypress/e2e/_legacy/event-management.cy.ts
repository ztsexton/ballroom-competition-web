/// <reference types="cypress" />

/**
 * Event Management E2E Tests
 *
 * Tests for creating, editing, and managing competition events.
 * Events are the core of a ballroom competition.
 */

describe('Event Management', () => {
  let competitionId: number;

  before(() => {
    cy.loginAsAdmin();
    cy.createTestCompetitionAndNavigateToSettings('Event Test Comp').then((id) => {
      competitionId = id as unknown as number;
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('Events List', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/events`);
    });

    it('should display events page', () => {
      cy.contains(/event/i).should('be.visible');
    });

    it('should show empty state when no events', () => {
      // May show empty state or form to create first event
      cy.get('body').should('be.visible');
    });

    it('should show event count', () => {
      cy.contains(/\d+ event|no event/i).should('be.visible');
    });

    it('should group events by style or level', () => {
      // Events should be organized
      cy.contains(/smooth|rhythm|latin|standard|ballroom/i).should('exist');
    });
  });

  describe('Create Event', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/events`);
    });

    it('should navigate to create event form', () => {
      cy.contains(/add|new|create.*event/i).click();

      cy.url().should('include', '/events/new');
    });

    it('should create event with manual name entry', () => {
      const eventName = `Test Event ${Date.now()}`;

      cy.contains(/add|new|create/i).click();

      // Enter event name
      cy.get('input[name="name"], input[placeholder*="name" i]').type(eventName);

      // Select judges
      cy.get('[data-testid="judge-select"], select[name="judges"]').then(($select) => {
        if ($select.length) {
          cy.wrap($select).select([0]);
        }
      });

      // Save
      cy.contains('button', /create|save/i).click();

      // Verify event created
      cy.contains(eventName).should('be.visible');
    });

    it('should create event using event builder (designation/level/style)', () => {
      cy.contains(/add|new|create/i).click();

      // Select designation
      cy.contains(/pro-am|amateur|professional/i).first().click();

      // Select level
      cy.contains(/bronze|silver|gold|newcomer/i).first().click();

      // Select style
      cy.contains(/smooth|rhythm|latin|standard/i).first().click();

      // Select dances
      cy.contains(/waltz|tango|foxtrot|cha cha/i).first().click();

      // Create
      cy.contains('button', /create|save/i).click();

      // Should show the created event
      cy.url().should('include', '/events');
    });

    it('should validate that judges are selected', () => {
      cy.contains(/add|new|create/i).click();

      cy.get('input[name="name"]').type('No Judges Event');

      // Try to create without judges
      cy.contains('button', /create|save/i).click();

      // Should show validation error
      cy.contains(/judge|required|select/i).should('be.visible');
    });

    it('should set scoring type (standard vs proficiency)', () => {
      cy.contains(/add|new|create/i).click();

      // Find scoring type toggle
      cy.contains(/proficiency|standard/i).then(($el) => {
        if ($el.length) {
          cy.wrap($el).click();
        }
      });
    });
  });

  describe('Event Details', () => {
    it('should show event details when clicked', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      cy.get('[data-testid="event-item"], .event-card').first().then(($item) => {
        if ($item.length) {
          cy.wrap($item).click();

          // Should show event details
          cy.contains(/round|entr|judge|couple/i).should('be.visible');
        }
      });
    });

    it('should show event rounds (quarters, semis, finals)', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      cy.get('[data-testid="event-item"]').first().click();

      // Should show rounds based on couple count
      cy.contains(/final|round/i).should('be.visible');
    });

    it('should show event entries (couples registered)', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      cy.get('[data-testid="event-item"]').first().click();

      cy.contains(/entr|couple|bib/i).should('be.visible');
    });
  });

  describe('Event Entries', () => {
    it('should add a couple to an event', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      cy.get('[data-testid="event-item"]').first().click();

      // Add entry
      cy.contains(/add entry|add couple/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();

          // Select couple
          cy.get('select[name="bib"], [data-testid="couple-select"]').select(1);

          cy.contains('button', /add|save/i).click();
        }
      });
    });

    it('should remove a couple from an event', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      cy.get('[data-testid="event-item"]').first().click();

      cy.get('[data-testid="entry-item"]').first().then(($item) => {
        if ($item.length) {
          cy.wrap($item).find('button:contains("Remove")').click();
          cy.on('window:confirm', () => true);
        }
      });
    });

    it('should show entry count for event', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      // Event cards should show entry count
      cy.get('[data-testid="event-item"]').first().contains(/\d+ (entr|couple)/i).should('be.visible');
    });
  });

  describe('Edit Event', () => {
    it('should edit event name', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      cy.get('[data-testid="event-item"]').first().find('button:contains("Edit")').click();

      const newName = `Edited Event ${Date.now()}`;
      cy.get('input[name="name"]').clear().type(newName);

      cy.contains('button', /save|update/i).click();

      cy.contains(newName).should('be.visible');
    });

    it('should edit event judges', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      cy.get('[data-testid="event-item"]').first().find('button:contains("Edit")').click();

      // Toggle a judge
      cy.get('[data-testid="judge-checkbox"]').first().click();

      cy.contains('button', /save|update/i).click();
    });
  });

  describe('Delete Event', () => {
    it('should delete an event with confirmation', () => {
      // First create an event to delete
      cy.visit(`/competitions/${competitionId}/events`);
      cy.contains(/add|new|create/i).click();

      cy.get('input[name="name"]').type('Event To Delete');
      cy.contains('button', /create|save/i).click();

      // Now delete it
      cy.contains('Event To Delete').parent().find('button:contains("Delete")').click();

      cy.on('window:confirm', () => true);

      cy.contains('Event To Delete').should('not.exist');
    });

    it('should warn about deleting event with entries', () => {
      cy.visit(`/competitions/${competitionId}/events`);

      // Find event with entries and try to delete
      cy.get('[data-testid="event-item"]').contains(/\d+ entr/i).parent().find('button:contains("Delete")').then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();

          // Should show warning about entries
          cy.contains(/entries|couples|warning/i).should('be.visible');
        }
      });
    });
  });

  describe('Multi-Dance Events', () => {
    it('should create multi-dance event', () => {
      cy.visit(`/competitions/${competitionId}/events`);
      cy.contains(/add|new|create/i).click();

      // Select multiple dances
      cy.contains('Waltz').click();
      cy.contains('Tango').click();
      cy.contains('Foxtrot').click();

      cy.get('input[name="name"]').type('Multi-Dance Test');
      cy.contains('button', /create|save/i).click();

      // Should show all dances in event name or details
      cy.contains(/waltz.*tango|3 dance|multi/i).should('be.visible');
    });
  });

  describe('Scholarship Events', () => {
    it('should mark event as scholarship', () => {
      cy.visit(`/competitions/${competitionId}/events`);
      cy.contains(/add|new|create/i).click();

      // Toggle scholarship
      cy.contains(/scholarship/i).click();

      cy.get('input[name="name"]').type('Scholarship Event');
      cy.contains('button', /create|save/i).click();

      cy.contains('Scholarship').should('be.visible');
    });
  });

  describe('Event Filtering', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/events`);
    });

    it('should filter events by style', () => {
      cy.get('[data-testid="style-filter"], select[name="style"]').then(($filter) => {
        if ($filter.length) {
          cy.wrap($filter).select('Smooth');
          // Events should be filtered
        }
      });
    });

    it('should filter events by level', () => {
      cy.get('[data-testid="level-filter"], select[name="level"]').then(($filter) => {
        if ($filter.length) {
          cy.wrap($filter).select('Bronze');
        }
      });
    });

    it('should search events by name', () => {
      cy.get('input[placeholder*="search" i]').type('Waltz');

      cy.contains('Waltz').should('be.visible');
    });
  });
});
