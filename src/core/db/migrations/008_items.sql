-- Migration 008: Items entity (Sprint 15g)
-- First-class item tracking for magic items, quest objects, equipment, and loot.

CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rarity TEXT,
    category TEXT,
    properties TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    source_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_campaign ON items(campaign_id);

CREATE TABLE IF NOT EXISTS scene_items (
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    PRIMARY KEY (scene_id, item_id)
);
