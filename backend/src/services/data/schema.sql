-- Ballroom Competition Scorer — PostgreSQL schema

CREATE TABLE IF NOT EXISTS competitions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT,
  studio_id INTEGER,
  description TEXT,
  judge_settings JSONB,
  default_scoring_type TEXT,
  levels JSONB,
  pricing JSONB,
  entry_payments JSONB DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  contact_info TEXT,
  mindbody_site_id TEXT,
  mindbody_token TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rule_preset_key TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  studio_id INTEGER
);

CREATE TABLE IF NOT EXISTS couples (
  bib SERIAL PRIMARY KEY,
  leader_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  follower_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  leader_name TEXT NOT NULL,
  follower_name TEXT NOT NULL,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS judges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  judge_number INTEGER NOT NULL,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  designation TEXT,
  syllabus_type TEXT,
  level TEXT,
  style TEXT,
  dances JSONB,
  heats JSONB NOT NULL DEFAULT '[]',
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  scoring_type TEXT,
  is_scholarship BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS scores (
  event_id INTEGER NOT NULL,
  round TEXT NOT NULL,
  bib INTEGER NOT NULL,
  dance TEXT NOT NULL DEFAULT '',
  scores JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (event_id, round, bib, dance)
);

CREATE TABLE IF NOT EXISTS judge_scores (
  event_id INTEGER NOT NULL,
  round TEXT NOT NULL,
  bib INTEGER NOT NULL,
  judge_id INTEGER NOT NULL,
  dance TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL,
  PRIMARY KEY (event_id, round, bib, judge_id, dance)
);

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  phone TEXT,
  city TEXT,
  state_region TEXT,
  country TEXT,
  studio_team_name TEXT,
  sign_in_methods JSONB NOT NULL DEFAULT '[]',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

-- Migration: add profile fields to users (for existing deployments)
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_region TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS studio_team_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sign_in_methods JSONB NOT NULL DEFAULT '[]';

-- Migration: add organization_id to competitions (for existing deployments)
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS organization_id INTEGER;

-- Migration: add is_chairman to judges (for existing deployments)
ALTER TABLE judges ADD COLUMN IF NOT EXISTS is_chairman BOOLEAN DEFAULT FALSE;

-- Migration: add age_category to events (for existing deployments)
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_category TEXT;

-- Migration: add timing_settings and registration_open to competitions
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS timing_settings JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS registration_open BOOLEAN DEFAULT FALSE;

-- Migration: add user_id to people (for linking to Firebase users)
ALTER TABLE people ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Migration: add dance column to scores and judge_scores for multi-dance events
-- Note: These require recreating the table if migrating from old schema without dance column
-- For fresh installs, dance column is already in the CREATE TABLE above

-- Performance indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_people_competition_id ON people(competition_id);
CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
CREATE INDEX IF NOT EXISTS idx_couples_competition_id ON couples(competition_id);
CREATE INDEX IF NOT EXISTS idx_couples_leader_id ON couples(leader_id);
CREATE INDEX IF NOT EXISTS idx_couples_follower_id ON couples(follower_id);
CREATE INDEX IF NOT EXISTS idx_judges_competition_id ON judges(competition_id);
CREATE INDEX IF NOT EXISTS idx_events_competition_id ON events(competition_id);
CREATE INDEX IF NOT EXISTS idx_scores_event_round ON scores(event_id, round);
CREATE INDEX IF NOT EXISTS idx_judge_scores_event_round_judge ON judge_scores(event_id, round, judge_id);
CREATE INDEX IF NOT EXISTS idx_competitions_organization_id ON competitions(organization_id);

-- Migration: add competition fields for visibility, public settings, and floor management
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS publicly_visible BOOLEAN;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS publicly_visible_at TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS results_public BOOLEAN;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS heat_lists_published BOOLEAN;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS heat_lists_published_at TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS registration_open_at TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS organizer_email TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS max_couples_per_heat INTEGER;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS max_couples_on_floor INTEGER;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS max_couples_on_floor_by_level JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS recall_rules JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS entry_validation JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS age_categories JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS level_mode TEXT;

-- Migration: add date_of_birth and age_category to people
ALTER TABLE people ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS age_category TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS level TEXT;

CREATE TABLE IF NOT EXISTS schedules (
  competition_id INTEGER PRIMARY KEY REFERENCES competitions(id) ON DELETE CASCADE,
  heat_order JSONB NOT NULL DEFAULT '[]',
  style_order JSONB NOT NULL DEFAULT '[]',
  level_order JSONB NOT NULL DEFAULT '[]',
  current_heat_index INTEGER NOT NULL DEFAULT 0,
  current_dance TEXT,
  heat_statuses JSONB NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Migration: add current_dance to schedules (for existing deployments)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS current_dance TEXT;

-- Performance indexes for batch scoring queries
CREATE INDEX IF NOT EXISTS idx_judge_scores_event_round_bib ON judge_scores(event_id, round, bib);
CREATE INDEX IF NOT EXISTS idx_people_comp_email_lower ON people(competition_id, (LOWER(email)));

-- Migration: add created_by to competitions (tracks who created the competition)
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Competition admins table (per-competition admin role)
CREATE TABLE IF NOT EXISTS competition_admins (
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL,
  PRIMARY KEY (competition_id, user_uid)
);
CREATE INDEX IF NOT EXISTS idx_competition_admins_user ON competition_admins(user_uid);

-- Migration: add scratched_bibs to events (for day-of scratch/withdraw)
ALTER TABLE events ADD COLUMN IF NOT EXISTS scratched_bibs JSONB DEFAULT '[]';

-- Migration: add dance_order to competitions (custom dance ordering per style)
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS dance_order JSONB;

-- Migration: add max_judge_hours_without_break to competitions
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS max_judge_hours_without_break REAL;

-- Site settings table (singleton row)
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_judge_hours_without_break REAL
);

-- Judge profiles table (site-level judge qualifications)
CREATE TABLE IF NOT EXISTS judge_profiles (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  user_uid TEXT,
  certifications JSONB DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Migration: add profile_id to judges (link to site-level judge profile)
ALTER TABLE judges ADD COLUMN IF NOT EXISTS profile_id INTEGER;

-- Migration: add section events and duplicate entries support
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS allow_duplicate_entries BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS section_group_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS section_letter TEXT;

-- Migration: unique index on people email so the same person can be reused across competitions
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_unique_email ON people(LOWER(email)) WHERE email IS NOT NULL;

-- Migration: add judge_role to judges (main/fill-in designation)
ALTER TABLE judges ADD COLUMN IF NOT EXISTS judge_role TEXT DEFAULT NULL;

-- Migration: add results_visibility for selective results publishing
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS results_visibility JSONB;

-- Migration: add schedule day configs, number of days, and hard stop time
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS number_of_days INTEGER;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS schedule_day_configs JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS hard_stop_time TEXT;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS event_templates JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS invoice_branding JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS scoring_type_defaults JSONB;

-- Migration: add bill_to to couples (billing assignment: split, leader, follower)
ALTER TABLE couples ADD COLUMN IF NOT EXISTS bill_to TEXT DEFAULT NULL;

-- Migration: add scholarship levels and templates
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS scholarship_levels JSONB;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS scholarship_templates JSONB;

-- ─── Phase 1: event_entries junction table ───────────────────────────
CREATE TABLE IF NOT EXISTS event_entries (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  bib INTEGER NOT NULL,
  competition_id INTEGER NOT NULL,
  scratched BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, bib)
);

CREATE INDEX IF NOT EXISTS idx_event_entries_bib ON event_entries (competition_id, bib);
CREATE INDEX IF NOT EXISTS idx_event_entries_event ON event_entries (event_id) WHERE NOT scratched;

-- Migration: populate event_entries from existing heats JSONB
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM event_entries LIMIT 1) THEN
    INSERT INTO event_entries (event_id, bib, competition_id, scratched)
    SELECT e.id, (bib_value)::INTEGER, e.competition_id, false
    FROM events e, jsonb_array_elements_text(e.heats->0->'bibs') AS bib_value
    WHERE jsonb_array_length(e.heats) > 0
      AND jsonb_array_length(e.heats->0->'bibs') > 0
    ON CONFLICT DO NOTHING;

    -- Migrate scratched_bibs into the scratched column
    UPDATE event_entries ee
    SET scratched = true
    FROM events e
    WHERE ee.event_id = e.id
      AND e.scratched_bibs IS NOT NULL
      AND jsonb_array_length(e.scratched_bibs) > 0
      AND ee.bib IN (SELECT (sb)::INTEGER FROM jsonb_array_elements_text(e.scratched_bibs) sb);
  END IF;
END $$;

-- ─── Phase 2: entry_payments table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS entry_payments (
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL,
  bib INTEGER NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_by INTEGER,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  PRIMARY KEY (competition_id, event_id, bib)
);

CREATE INDEX IF NOT EXISTS idx_entry_payments_unpaid ON entry_payments (competition_id) WHERE NOT paid;

-- Migration: move entry_payments from competitions JSONB to entry_payments table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'competitions' AND column_name = 'entry_payments') THEN
    INSERT INTO entry_payments (competition_id, event_id, bib, paid, paid_by, paid_at, notes)
    SELECT c.id,
           split_part(key, ':', 1)::INTEGER,
           split_part(key, ':', 2)::INTEGER,
           COALESCE((value->>'paid')::BOOLEAN, false),
           (value->>'paidBy')::INTEGER,
           (value->>'paidAt')::TIMESTAMPTZ,
           value->>'notes'
    FROM competitions c, jsonb_each(c.entry_payments) AS kv(key, value)
    WHERE c.entry_payments IS NOT NULL AND c.entry_payments != '{}'::jsonb
    ON CONFLICT DO NOTHING;

    ALTER TABLE competitions DROP COLUMN entry_payments;
  END IF;
END $$;

-- ─── Phase 3: pending_entries table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_entries (
  id TEXT NOT NULL,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  bib INTEGER NOT NULL,
  combination JSONB NOT NULL,
  reason TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by TEXT,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pending_entries_competition ON pending_entries (competition_id);
