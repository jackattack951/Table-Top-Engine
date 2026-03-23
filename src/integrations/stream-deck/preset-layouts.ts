/**
 * Stream Deck preset layouts for TTRPG Stage Manager.
 *
 * Each layout targets a specific Stream Deck model and use case.
 * Import into Bitfocus Companion via the Buttons → Import panel.
 *
 * All actionId values map to actions defined in CompanionModule.actions.
 */
import type { StreamDeckButton, StreamDeckLayout } from './types'

export type { StreamDeckButton, StreamDeckLayout }

export const STREAM_DECK_LAYOUTS: StreamDeckLayout[] = [
  // ── Combat Control — Stream Deck XL (4×8) ─────────────────────────────────
  {
    id: 'combat-control',
    label: 'Combat Control',
    deviceType: 'xl',
    description: '4×8 layout for combat encounters (requires Stream Deck XL)',
    buttons: [
      // Row 0: Mood controls (5 buttons)
      {
        position: { row: 0, col: 0 },
        label: 'Mood--',
        actionId: 'mood_decrement',
        options: { step: 25 },
        style: { bgcolor: '#1a237e', color: '#ffffff' },
      },
      {
        position: { row: 0, col: 1 },
        label: 'Mood-',
        actionId: 'mood_decrement',
        options: { step: 10 },
        style: { bgcolor: '#283593', color: '#ffffff' },
      },
      {
        position: { row: 0, col: 2 },
        label: 'Mood',
        actionId: 'mood_set',
        options: { value: 30 },
        style: { bgcolor: '#37474f', color: '#ffffff' },
      },
      {
        position: { row: 0, col: 3 },
        label: 'Mood+',
        actionId: 'mood_increment',
        options: { step: 10 },
        style: { bgcolor: '#b71c1c', color: '#ffffff' },
      },
      {
        position: { row: 0, col: 4 },
        label: 'Mood++',
        actionId: 'mood_increment',
        options: { step: 25 },
        style: { bgcolor: '#7f0000', color: '#ffffff' },
      },

      // Row 1: Scene environments
      {
        position: { row: 1, col: 0 },
        label: 'Tavern',
        actionId: 'preset_apply',
        options: { preset_id: 'tavern-clear-day' },
        style: { bgcolor: '#4e342e', color: '#ffcc80' },
      },
      {
        position: { row: 1, col: 1 },
        label: 'Dungeon',
        actionId: 'preset_apply',
        options: { preset_id: 'dungeon-cave' },
        style: { bgcolor: '#212121', color: '#9e9e9e' },
      },
      {
        position: { row: 1, col: 2 },
        label: 'Forest',
        actionId: 'preset_apply',
        options: { preset_id: 'forest-clear' },
        style: { bgcolor: '#1b5e20', color: '#a5d6a7' },
      },
      {
        position: { row: 1, col: 3 },
        label: 'City',
        actionId: 'preset_apply',
        options: { preset_id: 'city-night' },
        style: { bgcolor: '#0d47a1', color: '#90caf9' },
      },
      {
        position: { row: 1, col: 4 },
        label: 'Underdark',
        actionId: 'preset_apply',
        options: { preset_id: 'underdark-default' },
        style: { bgcolor: '#0a0a0a', color: '#7c4dff' },
      },

      // Row 2: SFX
      {
        position: { row: 2, col: 0 },
        label: 'Thunder',
        actionId: 'sfx_trigger',
        options: { clip_id: 'thunder', file_path: '/assets/sfx/thunder.ogg', label: 'Thunder', volume: 90, loop: false, spatial_x: 50, spatial_y: 50 },
        style: { bgcolor: '#263238', color: '#eceff1' },
      },
      {
        position: { row: 2, col: 1 },
        label: 'Hit',
        actionId: 'sfx_trigger',
        options: { clip_id: 'combat-hit', file_path: '/assets/sfx/combat-hit.ogg', label: 'Combat Hit', volume: 80, loop: false, spatial_x: 50, spatial_y: 50 },
        style: { bgcolor: '#880e4f', color: '#f8bbd9' },
      },
      {
        position: { row: 2, col: 2 },
        label: 'Rain',
        actionId: 'sfx_trigger',
        options: { clip_id: 'rain', file_path: '/assets/sfx/rain-loop.ogg', label: 'Rain', volume: 50, loop: true, spatial_x: 50, spatial_y: 50 },
        style: { bgcolor: '#006064', color: '#b2ebf2' },
      },
      {
        position: { row: 2, col: 3 },
        label: 'Stop Rain',
        actionId: 'sfx_stop',
        options: { clip_id: 'rain' },
        style: { bgcolor: '#37474f', color: '#b0bec5' },
      },
      {
        position: { row: 2, col: 4 },
        label: 'Coin Drop',
        actionId: 'sfx_trigger',
        options: { clip_id: 'coin-drop', file_path: '/assets/sfx/coin-drop.ogg', label: 'Coin Drop', volume: 60, loop: false, spatial_x: 50, spatial_y: 50 },
        style: { bgcolor: '#f57f17', color: '#fff9c4' },
      },

      // Row 3: FX overlays + Next Turn
      {
        position: { row: 3, col: 0 },
        label: 'FX: Fog',
        actionId: 'fx_overlay_play',
        options: { clip_id: 'fog', url: '/assets/fx/fog.webm', loop_offset: 0.1 },
        style: { bgcolor: '#546e7a', color: '#cfd8dc' },
      },
      {
        position: { row: 3, col: 1 },
        label: 'Stop FX',
        actionId: 'fx_overlay_stop',
        options: { clip_id: 'fog' },
        style: { bgcolor: '#37474f', color: '#b0bec5' },
      },
      {
        position: { row: 3, col: 2 },
        label: 'NEXT\nTURN',
        actionId: 'combat_next_turn',
        options: {},
        style: { bgcolor: '#1a237e', color: '#e8eaf6' },
      },
      {
        position: { row: 3, col: 3 },
        label: 'Fog On',
        actionId: 'fx_overlay_play',
        options: { clip_id: 'smoke', url: '/assets/fx/smoke.webm', loop_offset: 0.1 },
        style: { bgcolor: '#4a148c', color: '#e1bee7' },
      },
      {
        position: { row: 3, col: 4 },
        label: 'Fog Off',
        actionId: 'fx_overlay_stop',
        options: { clip_id: 'smoke' },
        style: { bgcolor: '#37474f', color: '#b0bec5' },
      },
    ],
  },

  // ── Scene & Atmosphere — Stream Deck Standard (3×5) ────────────────────────
  {
    id: 'scene-atmosphere',
    label: 'Scene & Atmosphere',
    deviceType: 'standard',
    description: '3×5 layout for scene transitions and atmosphere control',
    buttons: [
      // Row 0: Mood ladder
      {
        position: { row: 0, col: 0 },
        label: 'Peaceful',
        actionId: 'mood_set',
        options: { value: 10 },
        style: { bgcolor: '#1b5e20', color: '#c8e6c9' },
      },
      {
        position: { row: 0, col: 1 },
        label: 'Calm',
        actionId: 'mood_set',
        options: { value: 25 },
        style: { bgcolor: '#2e7d32', color: '#a5d6a7' },
      },
      {
        position: { row: 0, col: 2 },
        label: 'Neutral',
        actionId: 'mood_set',
        options: { value: 50 },
        style: { bgcolor: '#f57f17', color: '#fff9c4' },
      },
      {
        position: { row: 0, col: 3 },
        label: 'Tense',
        actionId: 'mood_set',
        options: { value: 70 },
        style: { bgcolor: '#bf360c', color: '#fbe9e7' },
      },
      {
        position: { row: 0, col: 4 },
        label: 'Dramatic',
        actionId: 'mood_set',
        options: { value: 90 },
        style: { bgcolor: '#7f0000', color: '#ffcdd2' },
      },

      // Row 1: Particle toggles via presets
      {
        position: { row: 1, col: 0 },
        label: 'No FX',
        actionId: 'preset_apply',
        options: { preset_id: 'tavern-clear-day' },
        style: { bgcolor: '#37474f', color: '#eceff1' },
      },
      {
        position: { row: 1, col: 1 },
        label: 'Rain',
        actionId: 'preset_apply',
        options: { preset_id: 'forest-rain' },
        style: { bgcolor: '#0d47a1', color: '#bbdefb' },
      },
      {
        position: { row: 1, col: 2 },
        label: 'Snow',
        actionId: 'preset_apply',
        options: { preset_id: 'mountains-snow' },
        style: { bgcolor: '#e1f5fe', color: '#01579b' },
      },
      {
        position: { row: 1, col: 3 },
        label: 'Fog',
        actionId: 'preset_apply',
        options: { preset_id: 'dungeon-cave' },
        style: { bgcolor: '#263238', color: '#90a4ae' },
      },
      {
        position: { row: 1, col: 4 },
        label: 'Storm',
        actionId: 'preset_apply',
        options: { preset_id: 'forest-storm' },
        style: { bgcolor: '#311b92', color: '#d1c4e9' },
      },

      // Row 2: Environment presets
      {
        position: { row: 2, col: 0 },
        label: 'Tavern',
        actionId: 'preset_apply',
        options: { preset_id: 'tavern-rain-night' },
        style: { bgcolor: '#4e342e', color: '#ffcc80' },
      },
      {
        position: { row: 2, col: 1 },
        label: 'Castle',
        actionId: 'preset_apply',
        options: { preset_id: 'castle-foggy' },
        style: { bgcolor: '#37474f', color: '#cfd8dc' },
      },
      {
        position: { row: 2, col: 2 },
        label: 'Coast',
        actionId: 'preset_apply',
        options: { preset_id: 'coast-clear' },
        style: { bgcolor: '#006064', color: '#b2ebf2' },
      },
      {
        position: { row: 2, col: 3 },
        label: 'Mountains',
        actionId: 'preset_apply',
        options: { preset_id: 'mountains-snow' },
        style: { bgcolor: '#eceff1', color: '#263238' },
      },
      {
        position: { row: 2, col: 4 },
        label: 'Underdark',
        actionId: 'preset_apply',
        options: { preset_id: 'underdark-default' },
        style: { bgcolor: '#0a0a0a', color: '#7c4dff' },
      },
    ],
  },
]
