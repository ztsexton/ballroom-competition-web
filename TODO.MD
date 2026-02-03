# Ballroom Competition Web App — TODO

Requirements to finish and improve the application. Merges what's already implemented with remaining ideas (age categories, rules/validation, back-to-back minimization, and performance testing).

---

## 1. Current State

### Implemented

- People CRUD, Couples CRUD, Judges CRUD, Events CRUD
- Round-by-round scoring and results
- Automatic bib/judge numbering
- Round generation from competitor count
- Recall vs Final scoring UI
- Helpful empty states + prerequisite warnings
- Deletion confirmations + validation + navigation
- Organizations + rule presets (NDCA / USA Dance / custom)
- Scheduling/heats + heat sheets
- Competition day-of views (on-deck, live, judge scoring)
- Invoice generation and emailing
- User auth + profile management
- Public pages (home, results, pricing, FAQ)
- Participant portal

### Gaps

- Age categories configuration + default sets per org
- Validation: which events/levels/age categories a couple can enter
- Back-to-back detection + minimization logic
- Performance + concurrency test harness (judges scoring at once, audience reading heat sheets)

---

## 2. Product Goals

### Competitor

- Sign up fast, avoid confusing restrictions, get clear feedback
- Enter events in a guided way ("only show what you're eligible for")
- See heat sheets, schedule, and results quickly on mobile

### Organizer

- Create a competition with minimal setup
- Configure rules once (or pick NDCA/USA Dance preset)
- Add entries quickly (bulk / self-serve)
- Run events smoothly: heat sheets, scoring, results, fewer bottlenecks
- Reliability under load (multiple events, many judges scoring simultaneously)

---

## 3. Remaining Features

### A. Age Categories

- Add age category configuration to Organizations
- Default age category sets per rule preset (NDCA, USA Dance)
- Age category assignment for participants
- Filter eligible events by age category

### B. Entry Validation

- Validate which events/levels/age categories a couple can enter
- Show only eligible events during entry ("guided entry")
- Clear error messages when validation fails

### C. Back-to-Back Minimization

- Detect when a couple is scheduled in consecutive heats
- Minimization algorithm to reduce back-to-back occurrences
- Display warnings for unavoidable back-to-back scheduling

### D. Competition Enhancements

#### Visibility & Privacy

- **Publicly viewable toggle** — Competition creator controls whether the competition appears on the public-facing pages. Repurpose or rename the existing `registrationOpen` flag so there are two distinct controls: one for public visibility, one for registration status.
- **Results privacy** — Add a `resultsPublic` flag (default `true`). When `false`, only participants who entered the competition can view results. Default to `false` for STUDIO type competitions. Add a toggle in competition setup and make it easily accessible from the competition details page afterward.

#### Branding & Links

- **Competition logo** — Allow uploading a small logo/image that displays on the public home page listing and competition detail views.
- **Public website URL** — Optional field on the competition. Displayed as a link whenever someone views the competition (public or logged-in).
- **Contact organizer** — Add a "Contact Organizer" link/button that opens an email to the organizer. Requires storing an organizer contact email on the competition.

#### Participant-Facing Views

- When viewing a competition as a non-admin, show action buttons/links for:
  - **Register** — Link to the registration/entry flow
  - **Pay** — Link to a payment page (implementation TBD, but create the page shell)
  - **Heat Lists** — Link to the heat list view (the generated schedule)

#### Schedule vs Heat Lists Rename

- **Rename "Schedule" to "Heat Lists"** throughout the UI for the current schedule page (the generated heat order with timing).
- **New "Schedule" page** — An admin-facing page to configure the competition's general schedule: which events run on which days, session groupings, breaks, etc.
- **Heat Lists** become the output generated from the configured schedule — the detailed heat-by-heat order with all events and timing laid out.

### E. Age Categories

- Add age category configuration to Organizations
- Default age category sets per rule preset (NDCA, USA Dance)
- Age category assignment for participants
- Filter eligible events by age category

### F. Entry Validation

- Validate which events/levels/age categories a couple can enter
- Show only eligible events during entry ("guided entry")
- Clear error messages when validation fails

### G. Back-to-Back Minimization

- Detect when a couple is scheduled in consecutive heats
- Minimization algorithm to reduce back-to-back occurrences
- Display warnings for unavoidable back-to-back scheduling

### H. Performance + Concurrency Testing

- Test harness for multiple judges scoring simultaneously
- Load testing for audience reading heat sheets
- Verify data consistency under concurrent writes








