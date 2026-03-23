-- Migration 002: Notes System (Sprint 8b)
-- Adds notes table, scene_notes junction table, and scratchpad column on scenes.

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    body TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    source_file TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scene_notes (
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scene_id, note_id)
);

ALTER TABLE scenes ADD COLUMN scratchpad TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_notes_campaign ON notes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_source ON notes(source_file);
CREATE INDEX IF NOT EXISTS idx_scene_notes_scene ON scene_notes(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_notes_note ON scene_notes(note_id);
