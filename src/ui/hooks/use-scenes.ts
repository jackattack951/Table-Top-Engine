/**
 * Shared scene fetch/mutate helpers — extracted from SceneTab (Sprint 8a).
 * Used by DashboardTab and ScenesTab.
 */
import { useState, useEffect, useCallback } from 'react'
import { getServerUrl } from '../lib/sync'
import type { Scene } from '@core/types'

export function useScenes(campaignId: string | null) {
    const [scenes, setScenes] = useState<Scene[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchScenes = useCallback(async () => {
        if (!campaignId) { setScenes([]); return }
        setLoading(true)
        setError(null)
        try {
            const r = await fetch(`${getServerUrl()}/api/campaigns/${campaignId}/scenes`)
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            setScenes(await r.json() as Scene[])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load scenes')
        } finally {
            setLoading(false)
        }
    }, [campaignId])

    useEffect(() => { void fetchScenes() }, [fetchScenes])
    return { scenes, loading, error, refetch: fetchScenes }
}

export async function postScene(campaignId: string, name: string): Promise<Scene> {
    const r = await fetch(`${getServerUrl()}/api/campaigns/${campaignId}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Scene>
}

export async function patchScene(id: string, data: Partial<Omit<Scene, 'id' | 'campaignId'>>): Promise<Scene> {
    const r = await fetch(`${getServerUrl()}/api/scenes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Scene>
}
