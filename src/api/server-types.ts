/**
 * Shared server-side types used by server.ts and extracted handler modules.
 * Separated to avoid circular imports between server.ts and handler files.
 */
import type { AppConfig, CombatState } from '../core/types'

/**
 * State tracked server-side so it can be replayed to reconnecting clients.
 * Updated whenever the server receives a state-mutating event.
 */
export interface ServerState {
    activeCampaignId: string | null
    activeCampaignName: string | null
    activeSceneId: string | null
    combatState: CombatState | null
    moodValue: number
    avState: {
        particles: { type: string; intensity: number }
        colorGrade: Record<string, unknown>
        gbColorGrade: Record<string, unknown>
    } | null
    appMode: AppConfig['appMode']
    previewActive: boolean
}
