/**
 * Core TypeScript interfaces for the TTRPG Stage Manager.
 * All data models that cross system boundaries are defined here.
 * Read this file before creating any new interfaces — extend, don't duplicate.
 */

// ─── App Modes ───────────────────────────────────────────────────────────────

export type AppMode = 'headless' | 'play' | 'plan'
export type NetworkMode = 'local' | 'host'

export interface AppConfig {
    appMode: AppMode
    networkMode: NetworkMode
    serverPort: number
    avDisplayIndex: number // index of secondary monitor
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export type RuleSystem = '5e' | 'pathfinder2e' | 'call-of-cthulhu' | 'custom'

export const SYSTEM_LABELS: Record<RuleSystem, string> = {
    '5e': 'D&D 5e',
    pathfinder2e: 'Pathfinder 2e',
    'call-of-cthulhu': 'Call of Cthulhu',
    custom: 'Custom',
}

export interface Campaign {
    id: string
    name: string
    system: string // RuleSystem value or custom string
    startingSceneId: string | null  // auto-load on session start
    createdAt: string
    updatedAt: string
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export type ParticleType = 'none' | 'rain' | 'snow' | 'ash' | 'embers' | 'dust' | 'fog'

export interface ColorGrade {
    brightness: number   // -1.0 to 1.0, default 0
    contrast: number     // -1.0 to 1.0, default 0
    saturation: number   // -1.0 to 1.0, default 0
    temperature: number  // -1.0 to 1.0, default 0
    tint: string         // hex color, default '#000000' (none)
}

export interface SceneBranch {
    label: string
    targetSceneId: string
    transitionNote: string   // text reminder shown during transition (default '')
}

export interface Scene {
    id: string
    campaignId: string
    name: string
    sortOrder: number

    // AV state — everything needed to reproduce atmosphere
    backgroundPath: string | null
    gameboardPath: string | null           // media library or raw path
    backgroundAssetId: string | null       // references assets table
    gameboardAssetId: string | null        // references assets table
    overlays: string[]       // WebM loop file paths
    particles: {
        type: ParticleType
        intensity: number      // 0.0–1.0
    }
    colorGrade: ColorGrade
    gbColorGrade: ColorGrade  // independent color grade for gameboard layer
    audioMood: number        // 0.0–1.0, default mood slider position

    // Campaign data
    notes: string            // DM notes, supports [Trigger: Label] syntax
    linkedNPCIds: string[]
    linkedLocationIds: string[]

    // Session data
    scratchpad: string       // per-scene DM session notes

    // Timeline linked-list pointer (null = end of chain)
    nextSceneId: string | null

    // Branching
    branches: SceneBranch[]

    // Fog of War state (Sprint 10g)
    fogEnabled: boolean
    fogData: string | null  // base64 PNG bitmap, or null if no fog painted
}

// ─── Note ────────────────────────────────────────────────────────────────────

export type NoteType = 'scene' | 'location' | 'npc' | 'lore' | 'general' | 'quest' | 'session' | 'faction'

/** Valid status values per note type. Types not listed here have no status. */
export const NOTE_STATUS_OPTIONS: Partial<Record<NoteType, readonly string[]>> = {
    npc: ['Alive', 'Dead', 'Unknown', 'Missing'],
    quest: ['Active', 'In Progress', 'Resolved', 'Failed'],
    session: ['Draft', 'Complete'],
    faction: ['Active', 'Dissolved', 'Hidden'],
    location: ['Active', 'Destroyed', 'Hidden'],
}

/** Valid user-assignable color options for notes. */
export const NOTE_COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink'] as const
export type NoteColor = typeof NOTE_COLORS[number]

export interface Note {
    id: string
    campaignId: string
    title: string
    type: NoteType
    body: string              // main markdown content
    tags: string[]            // free-form tags
    sourceFile: string | null // original file path if imported
    pinned: boolean           // pinned to top of notes list
    archived: boolean         // soft-deleted, hidden from default view
    status: string | null     // type-specific status (see NOTE_STATUS_OPTIONS)
    color: NoteColor | null   // user-assignable color coding
    createdAt: string
    updatedAt: string
}

// ─── NPC ──────────────────────────────────────────────────────────────────────

export interface NPC {
    id: string
    campaignId: string
    name: string
    statBlock: Record<string, unknown>  // system-agnostic JSON blob
    personality: string
    notes: string
}

// ─── Combat ───────────────────────────────────────────────────────────────────

export interface Combatant {
    id: string
    name: string
    npcId: string | null      // null = player character
    initiative: number
    hpCurrent: number
    hpMax: number
    ac: number
    conditions: string[]      // 'poisoned', 'stunned', 'prone', etc.
    sortOrder: number
    isPlayer: boolean
}

export interface CombatState {
    combatants: Combatant[]
    currentRound: number
    activeCombatantId: string | null
}

// ─── SFX Soundboard ───────────────────────────────────────────────────────────

export interface SFXClip {
    id: string
    label: string          // e.g. "Thunder Crack", "Door Creak"
    filePath: string
    loop: boolean
    volume: number         // 0.0–1.0
    /**
     * Optional spatial position using normalized map coordinates (0–1).
     * x maps to PannerNode.positionX (-1 to +1, left→right)
     * y maps to PannerNode.positionZ (-1 to +1, front→rear)
     * PannerNode.positionY is always fixed at 0.
     */
    spatial?: {
        x: number
        y: number
    }
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
    id: string
    campaignId: string
    date: string
    notes: string
    combatLogs: unknown[]
}

// ─── Item ────────────────────────────────────────────────────────────────────

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact' | 'quest'
export type ItemCategory = 'weapon' | 'armor' | 'potion' | 'scroll' | 'wondrous' | 'ring' | 'staff' | 'wand' | 'quest' | 'tool' | 'other'

export const ITEM_RARITIES: readonly ItemRarity[] = ['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact', 'quest']
export const ITEM_CATEGORIES: readonly ItemCategory[] = ['weapon', 'armor', 'potion', 'scroll', 'wondrous', 'ring', 'staff', 'wand', 'quest', 'tool', 'other']

export interface Item {
    id: string
    campaignId: string
    name: string
    description: string        // markdown body
    rarity: ItemRarity | null
    category: ItemCategory | null
    properties: string[]       // e.g. ['attunement', 'cursed', 'consumable']
    tags: string[]             // free-form tags
    sourceNoteId: string | null // note this item was extracted from
    createdAt: string
    updatedAt: string
}

/** Status of an item within a scene (scene_items junction). */
export type ItemStatus = 'hidden' | 'loot' | 'acquired'
export const ITEM_STATUSES: readonly ItemStatus[] = ['hidden', 'loot', 'acquired']

/** An item linked to a scene with its status. */
export interface SceneItem extends Item {
    status: ItemStatus
}

// ─── Import Sources ───────────────────────────────────────────────────────────

export type ImportSourceType = 'obsidian' | 'generic'

export interface ImportSource {
    id: string
    campaignId: string
    type: ImportSourceType
    path: string
    lastSynced: string | null
}

/**
 * Result returned by the Obsidian vault importer and surfaced to the cockpit UI
 * via IPC. Lives in types.ts so both the main-process importer and the renderer
 * can reference it without the renderer importing the importer module itself.
 */
export interface ImportResult {
    imported: number
    skipped: number
    errors: string[]
}
