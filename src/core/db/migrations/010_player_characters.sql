-- Migration 010: Player Characters roster
-- Stores pre-defined characters per campaign for the companion join flow.
-- The DM populates this roster; players can select from it during session join.

CREATE TABLE IF NOT EXISTS player_characters (
    id           TEXT    PRIMARY KEY,
    campaign_id  TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_name TEXT  NOT NULL,
    class        TEXT    NOT NULL DEFAULT 'Fighter',
    level        INTEGER NOT NULL DEFAULT 1,
    max_hp       INTEGER NOT NULL DEFAULT 10,
    ac           INTEGER NOT NULL DEFAULT 10,
    abilities    TEXT    NOT NULL DEFAULT '{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10}',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_player_characters_campaign
    ON player_characters(campaign_id);
