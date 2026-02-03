Ballroom Competition Web App — Requirements to Finish + Improve
This document merges what’s already implemented with the new ideas (age categories, rules/validation, back-to-back minimization, and performance testing). It’s written to hand directly to AI coding agents to implement the remaining functionality and to add automated tests.
1) Current State (Baseline)
✅ Implemented (end-to-end workflow)
People CRUD → Couples CRUD → Judges CRUD → Events CRUD → Round-by-round scoring → Results
Automatic bib/judge numbering
Round generation from competitor count
Recall vs Final scoring UI
Helpful empty states + prerequisite warnings
Deletion confirmations + validation + navigation
⚠️ Gaps vs “dead simple” organizer/competitor flow
Even with core workflow done, you’ll still want:
Organization “rule presets” (NDCA / USA Dance / custom)
Age categories configuration + default sets per org
Validation: which events/levels/age categories a couple can enter
Scheduling/heats + heat sheets (even if “simple mode”)
Back-to-back detection + minimization logic
Performance + concurrency test harness (judges scoring at once, audience reading heat sheets)
2) Product Goals
Competitor goals
Sign up fast, avoid confusing restrictions, get clear feedback
Enter events in a guided way (“only show what you’re eligible for”)
See heat sheets / schedule and results quickly on mobile
Organizer goals
Create a competition with minimal setup
Configure rules once (or pick NDCA/USA Dance preset)
Add entries quickly (bulk / self-serve)
Run events smoothly: heat sheets, scoring, results, fewer bottlenecks
Reliability under load (multiple events, many judges scoring simultaneously)
3) New Feature Requirements
A) Organizations + Rule Presets
A1. Organization entity
Requirement
Add Organization concept with configurable defaults and rules.
Data model
Organization
id
name (e.g., “NDCA”, “USA Dance”, “My Studio Comp”)
rulePresetKey (enum: ndca, usadance, custom)
createdAt, updatedAt
settings (JSON blob for custom overrides; versioned)
Acceptance criteria
Organizer can create/select an Organization for an Event.
Event inherits defaults from Organization unless overridden.
Tests
Unit: model validation and default resolution
Integration: Event creation correctly copies defaults
E2E: create org → create event → verify defaults applied