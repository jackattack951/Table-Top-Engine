/**
 * Stream Deck integration type definitions.
 * Used by preset-layouts.ts and the Companion module's action registry.
 */

export interface StreamDeckButton {
  /** Position on the Stream Deck grid (0-indexed) */
  position: { row: number; col: number }
  /** Button label text (supports newlines for multi-line display) */
  label: string
  /** Companion action ID to execute on press */
  actionId: string
  /** Action options passed to the Companion action's callback */
  options: Record<string, string | number | boolean>
  /** Button background and foreground colors as hex strings */
  style: { bgcolor: string; color: string }
}

export interface StreamDeckLayout {
  /** Unique layout identifier — used for import/export filenames */
  id: string
  /** Human-readable layout name */
  label: string
  /** Stream Deck device this layout targets */
  deviceType: 'mini' | 'standard' | 'xl' | 'plus'
  /** One-line description of this layout's purpose */
  description: string
  /** Array of button definitions */
  buttons: StreamDeckButton[]
}
