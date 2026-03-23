-- Migration 004: Fog of War (Sprint 10g)
-- Adds fog state columns to scenes table.
-- fog_data stores a PNG bitmap as a BLOB (base64-encoded for socket transit).
-- fog_enabled is a SQLite boolean (0/1).

ALTER TABLE scenes ADD COLUMN fog_data BLOB DEFAULT NULL;
ALTER TABLE scenes ADD COLUMN fog_enabled INTEGER NOT NULL DEFAULT 0;
