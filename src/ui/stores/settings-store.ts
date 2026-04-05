/**
 * Global settings store — persisted to localStorage via zustand/persist.
 * New pattern in this codebase: first store to use the persist middleware.
 * Storage key: 'stage-manager-settings', version: 1.
 *
 * Hydration is synchronous because the default localStorage storage engine
 * is synchronous. Settings are available before initSync() fires.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CharacterSelectMode } from '@shared/player-types'
import { VALID_CHARACTER_SELECT_MODES } from '@shared/player-types'

// ── State shape ──────────────────────────────────────────────────────────────

export interface SettingsState {
    // Audio output routing
    audioOutputDeviceId: string           // '' = system default

    // Volume defaults (applied on session start, 0.0–1.0)
    masterVolumeDefault: number
    musicVolumeDefault: number
    sfxVolumeDefault: number
    bgVideoVolumeDefault: number
    gbVideoVolumeDefault: number
    ambienceVolumeDefault: number

    // Companion lobby config
    characterSelectMode: CharacterSelectMode
    maxPlayers: number                    // 1–8
    autoApprove: boolean
    requireReadyCheck: boolean
    sessionCodeLength: number             // 4–8
}

interface SettingsActions {
    setAudioOutputDeviceId: (id: string) => void
    setMasterVolumeDefault: (v: number) => void
    setMusicVolumeDefault: (v: number) => void
    setSfxVolumeDefault: (v: number) => void
    setBgVideoVolumeDefault: (v: number) => void
    setGbVideoVolumeDefault: (v: number) => void
    setAmbienceVolumeDefault: (v: number) => void
    setCharacterSelectMode: (mode: CharacterSelectMode) => void
    setMaxPlayers: (n: number) => void
    setAutoApprove: (v: boolean) => void
    setRequireReadyCheck: (v: boolean) => void
    setSessionCodeLength: (n: number) => void
}

export type SettingsStore = SettingsState & SettingsActions

// ── Export/import types (Phase 23c) ──────────────────────────────────────────

export interface SettingsExport {
    version: 1
    theme: 'dark' | 'light'
    density: 'comfortable' | 'compact'
    settings: SettingsState
}

/** Returns the parsed export on success, null on any invalid shape. Never throws. */
export function validateSettingsExport(data: unknown): SettingsExport | null {
    if (!data || typeof data !== 'object') return null
    const d = data as Record<string, unknown>
    if (d['version'] !== 1) return null
    if (d['theme'] !== 'dark' && d['theme'] !== 'light') return null
    if (d['density'] !== 'comfortable' && d['density'] !== 'compact') return null
    const s = d['settings']
    if (!s || typeof s !== 'object') return null
    const settings = s as Record<string, unknown>
    if (typeof settings['audioOutputDeviceId'] !== 'string') return null
    const volumeKeys = [
        'masterVolumeDefault', 'musicVolumeDefault', 'sfxVolumeDefault',
        'bgVideoVolumeDefault', 'gbVideoVolumeDefault', 'ambienceVolumeDefault',
    ] as const
    for (const key of volumeKeys) {
        const v = settings[key]
        if (typeof v !== 'number' || v < 0 || v > 1) return null
    }
    if (!VALID_CHARACTER_SELECT_MODES.includes(settings['characterSelectMode'] as CharacterSelectMode)) return null
    const maxPlayers = settings['maxPlayers']
    if (typeof maxPlayers !== 'number' || maxPlayers < 1 || maxPlayers > 8) return null
    if (typeof settings['autoApprove'] !== 'boolean') return null
    if (typeof settings['requireReadyCheck'] !== 'boolean') return null
    const sessionCodeLength = settings['sessionCodeLength']
    if (typeof sessionCodeLength !== 'number' || sessionCodeLength < 4 || sessionCodeLength > 8) return null
    return data as SettingsExport
}

/** Extracts only the SettingsState fields from the full store (strips action functions). */
export function pickSettingsState(store: SettingsStore): SettingsState {
    return {
        audioOutputDeviceId: store.audioOutputDeviceId,
        masterVolumeDefault: store.masterVolumeDefault,
        musicVolumeDefault: store.musicVolumeDefault,
        sfxVolumeDefault: store.sfxVolumeDefault,
        bgVideoVolumeDefault: store.bgVideoVolumeDefault,
        gbVideoVolumeDefault: store.gbVideoVolumeDefault,
        ambienceVolumeDefault: store.ambienceVolumeDefault,
        characterSelectMode: store.characterSelectMode,
        maxPlayers: store.maxPlayers,
        autoApprove: store.autoApprove,
        requireReadyCheck: store.requireReadyCheck,
        sessionCodeLength: store.sessionCodeLength,
    }
}

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v))
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            audioOutputDeviceId: '',
            masterVolumeDefault: 0.8,
            musicVolumeDefault: 0.7,
            sfxVolumeDefault: 0.7,
            bgVideoVolumeDefault: 0.5,
            gbVideoVolumeDefault: 0.5,
            ambienceVolumeDefault: 0.7,
            characterSelectMode: 'manual-only',
            maxPlayers: 8,
            autoApprove: false,
            requireReadyCheck: false,
            sessionCodeLength: 6,

            setAudioOutputDeviceId: (audioOutputDeviceId) => set({ audioOutputDeviceId }),
            setMasterVolumeDefault: (v) => set({ masterVolumeDefault: clamp01(v) }),
            setMusicVolumeDefault: (v) => set({ musicVolumeDefault: clamp01(v) }),
            setSfxVolumeDefault: (v) => set({ sfxVolumeDefault: clamp01(v) }),
            setBgVideoVolumeDefault: (v) => set({ bgVideoVolumeDefault: clamp01(v) }),
            setGbVideoVolumeDefault: (v) => set({ gbVideoVolumeDefault: clamp01(v) }),
            setAmbienceVolumeDefault: (v) => set({ ambienceVolumeDefault: clamp01(v) }),
            setCharacterSelectMode: (characterSelectMode) => set({ characterSelectMode }),
            setMaxPlayers: (maxPlayers) => set({ maxPlayers: Math.max(1, Math.min(8, maxPlayers)) }),
            setAutoApprove: (autoApprove) => set({ autoApprove }),
            setRequireReadyCheck: (requireReadyCheck) => set({ requireReadyCheck }),
            setSessionCodeLength: (n) => set({ sessionCodeLength: Math.max(4, Math.min(8, n)) }),
        }),
        {
            name: 'stage-manager-settings',
            version: 1,
        }
    )
)
