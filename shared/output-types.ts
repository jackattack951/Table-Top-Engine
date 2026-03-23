/**
 * Shared output management types — used by server, cockpit, and Electron main.
 * Sprint 9b polish: extracted from output-store.ts for cross-boundary use.
 */

export interface DisplayInfo {
    id: number
    label: string
    width: number
    height: number
    bounds: { x: number; y: number; width: number; height: number }
    internal: boolean
}

export type OutputRole = 'BG' | 'GB'

export interface OutputConfig {
    displayId: number | 'windowed'
    role: OutputRole
    fullscreen: boolean
}
