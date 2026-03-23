/**
 * Audio Config — Environment audio configuration registry.
 * Maps each environment to its ambience track + 3 mood stems and BPM.
 *
 * Sprint 17c: 5 core environments for v0.6 pre-beta.
 * Files expected at /audio/stems/<env>/<env>-<zone>.<ext>
 * SFX files expected at /audio/sfx/<name>.ogg
 */

export interface EnvironmentAudioConfig {
    id: string
    label: string
    bpm: number
    stems: {
        ambience: string
        calm: string
        tense: string
        dramatic: string
    }
}

export interface SFXClipConfig {
    id: string
    label: string
    filePath: string
    defaultMode: 'oneshot' | 'loop'
    volume: number
}

/** Build the 4 stem paths for an environment following the naming convention. */
function buildStems(id: string, ext = 'ogg'): EnvironmentAudioConfig['stems'] {
    return {
        ambience: `/audio/stems/${id}/${id}-ambience.${ext}`,
        calm: `/audio/stems/${id}/${id}-calm.${ext}`,
        tense: `/audio/stems/${id}/${id}-tense.${ext}`,
        dramatic: `/audio/stems/${id}/${id}-dramatic.${ext}`,
    }
}

/**
 * 5 core environments for v0.6 — each with ambience + 3 mood stems sharing BPM.
 * Paths are relative to Express server root (served via /audio/ static route).
 */
export const ENVIRONMENT_AUDIO_CONFIGS: EnvironmentAudioConfig[] = [
    { id: 'forest',  label: 'Forest',  bpm: 80, stems: buildStems('forest', 'wav') },
    { id: 'cave',    label: 'Cave',    bpm: 70, stems: buildStems('cave') },
    { id: 'tavern',  label: 'Tavern',  bpm: 90, stems: buildStems('tavern') },
    { id: 'night',   label: 'Night',   bpm: 65, stems: buildStems('night') },
    { id: 'ocean',   label: 'Ocean',   bpm: 75, stems: buildStems('ocean') },
]

/**
 * SFX clips with real file paths for v0.6.
 * Paths served via /audio/ static route.
 */
export const SFX_CLIP_CONFIGS: SFXClipConfig[] = [
    { id: 'thunder', label: 'Thunder', filePath: '/audio/sfx/thunder.ogg', defaultMode: 'oneshot', volume: 0.9 },
    { id: 'door-creak', label: 'Door Creak', filePath: '/audio/sfx/door-creak.ogg', defaultMode: 'oneshot', volume: 0.7 },
    { id: 'sword-clash', label: 'Sword Clash', filePath: '/audio/sfx/sword-clash.ogg', defaultMode: 'oneshot', volume: 0.8 },
    { id: 'magic-burst', label: 'Magic Burst', filePath: '/audio/sfx/magic-burst.ogg', defaultMode: 'oneshot', volume: 0.8 },
    { id: 'footsteps', label: 'Footsteps', filePath: '/audio/sfx/footsteps.ogg', defaultMode: 'loop', volume: 0.5 },
    { id: 'campfire', label: 'Campfire', filePath: '/audio/sfx/campfire.ogg', defaultMode: 'loop', volume: 0.4 },
]

/**
 * Look up an environment audio config by ID.
 */
export function getEnvironmentAudioConfig(envId: string): EnvironmentAudioConfig | undefined {
    return ENVIRONMENT_AUDIO_CONFIGS.find((c) => c.id === envId)
}
