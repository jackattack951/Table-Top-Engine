-- Migration 003: Dashboard Overhaul — Scene Linking (Sprint 10a)
-- Adds next_scene_id linked-list pointer on scenes, scene_npcs junction table,
-- and scene_encounters junction table for future encounter system.

-- Scene linked-list ordering for timeline
ALTER TABLE scenes ADD COLUMN next_scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL;

-- Scene-NPC junction table (many-to-many)
CREATE TABLE IF NOT EXISTS scene_npcs (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scene_id, npc_id)
);
CREATE INDEX IF NOT EXISTS idx_scene_npcs_scene ON scene_npcs(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_npcs_npc ON scene_npcs(npc_id);

-- Scene-Encounter junction table (many-to-many, for future encounter system)
CREATE TABLE IF NOT EXISTS scene_encounters (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  encounter_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scene_id, encounter_id)
);
CREATE INDEX IF NOT EXISTS idx_scene_encounters_scene ON scene_encounters(scene_id);
