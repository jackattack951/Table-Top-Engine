-- TTRPG Stage Manager — SQLite Schema
-- Managed via numbered migration files. This is migration 001.
-- Tracked in _migrations table, applied sequentially on startup.

CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system TEXT NOT NULL DEFAULT '5e',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  background_path TEXT,
  overlays TEXT NOT NULL DEFAULT '[]',        -- JSON array of file paths
  particles TEXT NOT NULL DEFAULT '{"type":"none","intensity":0}',
  color_grade TEXT NOT NULL DEFAULT '{"brightness":0,"contrast":0,"saturation":0,"temperature":0,"tint":"#000000"}',
  audio_mood REAL NOT NULL DEFAULT 0.3,
  notes TEXT NOT NULL DEFAULT '',
  linked_npc_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array
  linked_location_ids TEXT NOT NULL DEFAULT '[]',
  branches TEXT NOT NULL DEFAULT '[]'         -- JSON array of { label, targetSceneId }
);

CREATE TABLE IF NOT EXISTS npcs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stat_block TEXT NOT NULL DEFAULT '{}',      -- JSON blob, system-agnostic
  personality TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS combatants (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  npc_id TEXT REFERENCES npcs(id),
  initiative INTEGER NOT NULL DEFAULT 0,
  hp_current INTEGER NOT NULL DEFAULT 0,
  hp_max INTEGER NOT NULL DEFAULT 0,
  ac INTEGER NOT NULL DEFAULT 10,
  conditions TEXT NOT NULL DEFAULT '[]',      -- JSON array of condition strings
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_player INTEGER NOT NULL DEFAULT 0        -- SQLite boolean
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  combat_logs TEXT NOT NULL DEFAULT '[]'      -- JSON array
);

CREATE TABLE IF NOT EXISTS import_sources (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                         -- 'obsidian' | 'generic'
  path TEXT NOT NULL,
  last_synced TEXT
);
