/**
 * Environment Presets — Sprint 5.
 * Pre-configured atmosphere bundles covering the 8 core environments from
 * Project.md Section 10.1. Each preset wires particles, color grade, and
 * audio mood into one-click application.
 *
 * Architecture constraint: imported directly in cockpit UI. No IPC, no REST.
 * The store setters + sync.ts subscriptions broadcast to AV Display automatically.
 */
import type { ParticleType, ColorGrade } from '@core/types'

export interface EnvironmentPreset {
    id: string
    label: string           // "Tavern — Rainy Night"
    environment: string     // "tavern"
    variant: string         // "rain-night"
    particles: { type: ParticleType; intensity: number }
    colorGrade: ColorGrade
    audioMood: number       // 0.0–1.0 default mood slider position
    description: string     // one-liner for DM
}

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
    // ── Tavern ──────────────────────────────────────────────────────────────
    {
        id: 'tavern-clear-day',
        label: 'Tavern — Clear Day',
        environment: 'tavern',
        variant: 'clear-day',
        particles: { type: 'none', intensity: 0 },
        colorGrade: { brightness: 0, contrast: 0.05, saturation: 0.05, temperature: 0.15, tint: '#000000' },
        audioMood: 0.2,
        description: 'Bustling midday inn, warm light through windows, chatter and clinking mugs.',
    },
    {
        id: 'tavern-rain-night',
        label: 'Tavern — Rainy Night',
        environment: 'tavern',
        variant: 'rain-night',
        particles: { type: 'rain', intensity: 0.4 },
        colorGrade: { brightness: -0.1, contrast: 0.05, saturation: -0.05, temperature: 0.1, tint: '#000000' },
        audioMood: 0.25,
        description: 'Cozy inn, heavy rain outside, candlelit warmth, strangers at every table.',
    },
    {
        id: 'tavern-foggy-morning',
        label: 'Tavern — Foggy Morning',
        environment: 'tavern',
        variant: 'foggy-morning',
        particles: { type: 'fog', intensity: 0.25 },
        colorGrade: { brightness: -0.05, contrast: 0, saturation: -0.1, temperature: 0.08, tint: '#000000' },
        audioMood: 0.15,
        description: 'Early morning, thin mist drifting under the eaves, only a few patrons about.',
    },

    // ── Dungeon ──────────────────────────────────────────────────────────────
    {
        id: 'dungeon-cave',
        label: 'Dungeon — Cave',
        environment: 'dungeon',
        variant: 'cave',
        particles: { type: 'fog', intensity: 0.3 },
        colorGrade: { brightness: -0.2, contrast: 0.1, saturation: -0.15, temperature: -0.2, tint: '#000000' },
        audioMood: 0.5,
        description: 'Deep stone corridors, dripping water, torchlight barely holds the dark.',
    },
    {
        id: 'dungeon-undead',
        label: 'Dungeon — Undead Crypt',
        environment: 'dungeon',
        variant: 'undead',
        particles: { type: 'dust', intensity: 0.3 },
        colorGrade: { brightness: -0.25, contrast: 0.15, saturation: -0.25, temperature: -0.25, tint: '#000000' },
        audioMood: 0.65,
        description: 'Ancient burial hall, bone dust in the air, the dead do not rest here.',
    },
    {
        id: 'dungeon-lava',
        label: 'Dungeon — Lava Cavern',
        environment: 'dungeon',
        variant: 'lava',
        particles: { type: 'embers', intensity: 0.5 },
        colorGrade: { brightness: 0.05, contrast: 0.15, saturation: 0.2, temperature: 0.3, tint: '#000000' },
        audioMood: 0.7,
        description: 'Volcanic cavern, rivers of lava below, embers drift upward through cracked stone.',
    },

    // ── Forest ───────────────────────────────────────────────────────────────
    {
        id: 'forest-clear',
        label: 'Forest — Clear',
        environment: 'forest',
        variant: 'clear',
        particles: { type: 'none', intensity: 0 },
        colorGrade: { brightness: 0.05, contrast: 0, saturation: 0.1, temperature: 0, tint: '#000000' },
        audioMood: 0.2,
        description: 'Sunlit woodland path, birdsong and rustling leaves, peaceful and bright.',
    },
    {
        id: 'forest-rain',
        label: 'Forest — Rain',
        environment: 'forest',
        variant: 'rain',
        particles: { type: 'rain', intensity: 0.6 },
        colorGrade: { brightness: -0.05, contrast: 0.05, saturation: -0.05, temperature: -0.1, tint: '#000000' },
        audioMood: 0.4,
        description: 'Rain-soaked canopy, mud underfoot, visibility reduced, every sound amplified.',
    },
    {
        id: 'forest-storm',
        label: 'Forest — Storm',
        environment: 'forest',
        variant: 'storm',
        particles: { type: 'rain', intensity: 0.9 },
        colorGrade: { brightness: -0.3, contrast: 0.2, saturation: -0.15, temperature: -0.2, tint: '#000000' },
        audioMood: 0.7,
        description: 'Violent storm, trees whipping, near-zero visibility, lightning on the horizon.',
    },

    // ── City ─────────────────────────────────────────────────────────────────
    {
        id: 'city-night',
        label: 'City — Night',
        environment: 'city',
        variant: 'night',
        particles: { type: 'none', intensity: 0 },
        colorGrade: { brightness: -0.15, contrast: 0.1, saturation: -0.05, temperature: 0.05, tint: '#000000' },
        audioMood: 0.3,
        description: 'City streets after dark, lantern glow, distant crowds, shadows everywhere.',
    },
    {
        id: 'city-rain',
        label: 'City — Rain',
        environment: 'city',
        variant: 'rain',
        particles: { type: 'rain', intensity: 0.5 },
        colorGrade: { brightness: -0.2, contrast: 0.05, saturation: -0.1, temperature: 0, tint: '#000000' },
        audioMood: 0.4,
        description: 'Wet cobblestones reflecting lantern light, citizens hurrying for cover.',
    },
    {
        id: 'city-day',
        label: 'City — Day',
        environment: 'city',
        variant: 'day',
        particles: { type: 'none', intensity: 0 },
        colorGrade: { brightness: 0.05, contrast: 0, saturation: 0.05, temperature: 0.05, tint: '#000000' },
        audioMood: 0.2,
        description: 'Bustling market district, merchants shouting, carts and crowds at every corner.',
    },

    // ── Castle / Keep ────────────────────────────────────────────────────────
    {
        id: 'castle-foggy',
        label: 'Castle — Foggy',
        environment: 'castle',
        variant: 'foggy',
        particles: { type: 'fog', intensity: 0.5 },
        colorGrade: { brightness: -0.1, contrast: 0.05, saturation: -0.1, temperature: -0.15, tint: '#000000' },
        audioMood: 0.55,
        description: 'Stone battlements shrouded in fog, torches guttering, the enemy unseen.',
    },
    {
        id: 'castle-throne',
        label: 'Castle — Throne Room',
        environment: 'castle',
        variant: 'throne',
        particles: { type: 'dust', intensity: 0.15 },
        colorGrade: { brightness: 0, contrast: 0.1, saturation: 0, temperature: 0.08, tint: '#000000' },
        audioMood: 0.35,
        description: 'Grand hall, high vaulted ceilings, dusty tapestries, a throne of cold stone.',
    },
    {
        id: 'castle-siege',
        label: 'Castle — Under Siege',
        environment: 'castle',
        variant: 'siege',
        particles: { type: 'ash', intensity: 0.5 },
        colorGrade: { brightness: -0.1, contrast: 0.2, saturation: -0.1, temperature: 0.1, tint: '#000000' },
        audioMood: 0.75,
        description: 'Walls under bombardment, ash and smoke fill the air, defenders scramble.',
    },

    // ── Underdark ────────────────────────────────────────────────────────────
    {
        id: 'underdark-default',
        label: 'Underdark',
        environment: 'underdark',
        variant: 'default',
        particles: { type: 'dust', intensity: 0.6 },
        colorGrade: { brightness: -0.4, contrast: 0.15, saturation: -0.3, temperature: -0.3, tint: '#000000' },
        audioMood: 0.6,
        description: 'Lightless depths below the world, alien fungi glow faintly, danger in every shadow.',
    },
    {
        id: 'underdark-bioluminescent',
        label: 'Underdark — Bioluminescent',
        environment: 'underdark',
        variant: 'bioluminescent',
        particles: { type: 'dust', intensity: 0.4 },
        colorGrade: { brightness: -0.2, contrast: 0.1, saturation: 0.15, temperature: -0.2, tint: '#000000' },
        audioMood: 0.45,
        description: 'Cavern alive with glowing mushrooms and spores, eerie beauty hiding predators.',
    },

    // ── Coast ────────────────────────────────────────────────────────────────
    {
        id: 'coast-clear',
        label: 'Coast — Clear',
        environment: 'coast',
        variant: 'clear',
        particles: { type: 'none', intensity: 0 },
        colorGrade: { brightness: 0.05, contrast: 0, saturation: 0.05, temperature: -0.05, tint: '#000000' },
        audioMood: 0.25,
        description: 'Open sea cliffs, salt air, wheeling gulls, the horizon stretching endlessly.',
    },
    {
        id: 'coast-storm',
        label: 'Coast — Storm',
        environment: 'coast',
        variant: 'storm',
        particles: { type: 'rain', intensity: 0.7 },
        colorGrade: { brightness: -0.2, contrast: 0.15, saturation: -0.1, temperature: -0.15, tint: '#000000' },
        audioMood: 0.6,
        description: 'Gale-force winds, crashing waves on rocky shores, a ship fighting to stay afloat.',
    },

    // ── Mountains ────────────────────────────────────────────────────────────
    {
        id: 'mountains-snow',
        label: 'Mountains — Snow',
        environment: 'mountains',
        variant: 'snow',
        particles: { type: 'snow', intensity: 0.7 },
        colorGrade: { brightness: 0.05, contrast: 0.05, saturation: -0.2, temperature: -0.25, tint: '#000000' },
        audioMood: 0.35,
        description: 'High alpine pass, heavy snowfall, the wind howls and visibility is near zero.',
    },
    {
        id: 'mountains-clear',
        label: 'Mountains — Clear',
        environment: 'mountains',
        variant: 'clear',
        particles: { type: 'none', intensity: 0 },
        colorGrade: { brightness: 0.08, contrast: 0.05, saturation: 0, temperature: -0.1, tint: '#000000' },
        audioMood: 0.2,
        description: 'Rocky summit under clear skies, the world spread below, cold thin air.',
    },
    {
        id: 'mountains-blizzard',
        label: 'Mountains — Blizzard',
        environment: 'mountains',
        variant: 'blizzard',
        particles: { type: 'snow', intensity: 1.0 },
        colorGrade: { brightness: -0.1, contrast: 0.1, saturation: -0.3, temperature: -0.35, tint: '#000000' },
        audioMood: 0.55,
        description: 'Whiteout blizzard, zero visibility, frostbite a real threat, shelter or die.',
    },
]

/**
 * Returns all unique environment identifiers present in the preset list.
 * Used to populate the environment selector dropdown.
 */
export function getEnvironments(): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const p of ENVIRONMENT_PRESETS) {
        if (!seen.has(p.environment)) {
            seen.add(p.environment)
            result.push(p.environment)
        }
    }
    return result
}

/**
 * Returns all presets for a given environment identifier.
 */
export function getPresetsForEnvironment(environment: string): EnvironmentPreset[] {
    return ENVIRONMENT_PRESETS.filter((p) => p.environment === environment)
}
