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
  scores JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (event_id, round, bib)
);

CREATE TABLE IF NOT EXISTS judge_scores (
  event_id INTEGER NOT NULL,
  round TEXT NOT NULL,
  bib INTEGER NOT NULL,
  judge_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  PRIMARY KEY (event_id, round, bib, judge_id)
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
