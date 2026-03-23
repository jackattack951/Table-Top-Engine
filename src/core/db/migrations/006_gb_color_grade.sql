-- Migration 006: Add independent gameboard color grade column
ALTER TABLE scenes ADD COLUMN gb_color_grade TEXT NOT NULL DEFAULT '{"brightness":0,"contrast":0,"saturation":0,"temperature":0,"tint":"#ffffff"}';
