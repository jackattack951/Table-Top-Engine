/**
 * Shared color constants for PixiJS rendering.
 * These must stay aligned with the CSS custom properties in src/ui/index.css.
 * When updating a color here, update the corresponding CSS token too.
 */
export const COLORS = {
  /** Matches --color-accent (#2DD4BF) */
  ACCENT: 0x2dd4bf,
  /** Standard black for canvas backgrounds, fog fill */
  BLACK: 0x000000,
  /** Standard white for placeholder textures */
  WHITE: 0xffffff,
} as const
