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

CREATE TABLE IF NOT EXISTS schedules (
  competition_id INTEGER PRIMARY KEY REFERENCES competitions(id) ON DELETE CASCADE,
  heat_order JSONB NOT NULL DEFAULT '[]',
  style_order JSONB NOT NULL DEFAULT '[]',
  level_order JSONB NOT NULL DEFAULT '[]',
  current_heat_index INTEGER NOT NULL DEFAULT 0,
  heat_statuses JSONB NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
