-- Migration 007: Notes system enhancements (Sprint 15a)
-- Adds pinned, archived, status, and color fields to notes table.

ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN status TEXT;
ALTER TABLE notes ADD COLUMN color TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(archived);
