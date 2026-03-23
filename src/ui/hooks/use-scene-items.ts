/**
 * useSceneItems — fetches items linked to the active scene via Scene-Item junction routes.
 * Updated Sprint 17c: returns SceneItem[] with status field, adds updateStatus helper.
 *
 * Endpoints used:
 *   GET    /api/scenes/:sceneId/items
 *   POST   /api/scenes/:sceneId/items/:itemId
 *   PATCH  /api/scenes/:sceneId/items/:itemId/status
 *   DELETE /api/scenes/:sceneId/items/:itemId
 *
 * Returns empty array when sceneId is null (no active scene).
 */
import { useState, useEffect, useCallback } from 'react'
import { getServerUrl } from '../lib/sync'
import type { SceneItem, ItemStatus } from '@core/types'

export interface UseSceneItemsResult {
    items: SceneItem[]
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
    linkItem: (itemId: string) => Promise<void>
    unlinkItem: (itemId: string) => Promise<void>
    updateStatus: (itemId: string, status: ItemStatus) => Promise<void>
}

export function useSceneItems(sceneId: string | null): UseSceneItemsResult {
    const [items, setItems] = useState<SceneItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchItems = useCallback(async () => {
        if (!sceneId) { setItems([]); return }
        setLoading(true)
        setError(null)
        try {
            const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/items`)
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            setItems(await r.json() as SceneItem[])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load scene items')
        } finally {
            setLoading(false)
        }
    }, [sceneId])

    useEffect(() => { void fetchItems() }, [fetchItems])

    const linkItem = useCallback(async (itemId: string) => {
        if (!sceneId) return
        const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/items/${itemId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        await fetchItems()
    }, [sceneId, fetchItems])

    const unlinkItem = useCallback(async (itemId: string) => {
        if (!sceneId) return
        const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/items/${itemId}`, {
            method: 'DELETE',
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        await fetchItems()
    }, [sceneId, fetchItems])

    const updateStatus = useCallback(async (itemId: string, status: ItemStatus) => {
        if (!sceneId) return
        const r = await fetch(`${getServerUrl()}/api/scenes/${sceneId}/items/${itemId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        await fetchItems()
    }, [sceneId, fetchItems])

    return { items, loading, error, refetch: fetchItems, linkItem, unlinkItem, updateStatus }
}
