-- Migration 009: Add status column to scene_items junction table.
-- Tracks item visibility state per scene: hidden (DM only), loot (revealed), acquired (claimed).
ALTER TABLE scene_items ADD COLUMN status TEXT NOT NULL DEFAULT 'hidden';
