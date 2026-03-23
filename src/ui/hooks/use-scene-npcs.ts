/**
 * useSceneNPCs — fetches NPCs linked to the active scene via Scene-NPC junction routes.
 *
 * Endpoints used:
 *   GET    /api/scenes/:sceneId/npcs
 *   POST   /api/scenes/:sceneId/npcs/:npcId
 *   DELETE /api/scenes/:sceneId/npcs/:npcId
 *
 * Returns empty array when sceneId is null (no active scene).
 */
import { useState, useEffect, useCallback } from 'react'
import { getServerUrl } from '../lib/sync'
import type { NPC } from '@core/types'

export interface UseSceneNPCsResult {
    npcs: NPC[]
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
    linkNPC: (npcId: string) => Promise<void>
    unlinkNPC: (npcId: string) => Promise<void>
}

export function useSceneNPCs(sceneId: string | null): UseSceneNPCsResult {
    const [npcs, setNpcs] = useState<NPC[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchNPCs = useCallback(async () => {
        if (!sceneId) { setNpcs([]); return }
        setLoading(true)
        setError(null)
        try {
            const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/npcs`)
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            setNpcs(await r.json() as NPC[])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load scene NPCs')
        } finally {
            setLoading(false)
        }
    }, [sceneId])

    useEffect(() => { void fetchNPCs() }, [fetchNPCs])

    const linkNPC = useCallback(async (npcId: string) => {
        if (!sceneId) return
        const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/npcs/${npcId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: 0 }),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        await fetchNPCs()
    }, [sceneId, fetchNPCs])

    const unlinkNPC = useCallback(async (npcId: string) => {
        if (!sceneId) return
        const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/npcs/${npcId}`, {
            method: 'DELETE',
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        await fetchNPCs()
    }, [sceneId, fetchNPCs])

    return { npcs, loading, error, refetch: fetchNPCs, linkNPC, unlinkNPC }
}
