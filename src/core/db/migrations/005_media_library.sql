-- Migration 005: Media Library — global asset management.
-- Adds assets table, per-campaign tagging, and scene media references.

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL,                          -- 'image' | 'video' | 'audio'
  file_size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  duration REAL,                                      -- seconds (video/audio)
  categories TEXT NOT NULL DEFAULT '[]',              -- JSON: AssetCategory[]
  tags TEXT NOT NULL DEFAULT '[]',                    -- JSON: string[]
  playback_mode TEXT NOT NULL DEFAULT 'loop',         -- 'loop' | 'once' | 'freeze'
  thumbnail TEXT,                                     -- base64 data URL
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_campaign_tags (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_act_campaign ON asset_campaign_tags(campaign_id);

-- Scene media references (asset-based approach supplements existing backgroundPath)
ALTER TABLE scenes ADD COLUMN gameboard_path TEXT;
ALTER TABLE scenes ADD COLUMN background_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE scenes ADD COLUMN gameboard_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL;

-- Campaign starting scene
ALTER TABLE campaigns ADD COLUMN starting_scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL;
