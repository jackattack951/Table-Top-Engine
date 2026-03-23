/**
 * Shared item fetch/mutate helpers — Sprint 15g.
 * Used by ItemsPanel. Mirrors use-notes.ts pattern.
 */
import { useState, useEffect, useCallback } from 'react'
import { getServerUrl } from '../lib/sync'
import { useItemsStore } from '../stores/items-store'
import type { Item } from '@core/types'

export function useItems(campaignId: string | null) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchItems = useCallback(async () => {
        if (!campaignId) {
            useItemsStore.getState().setItems([])
            return
        }
        setLoading(true)
        useItemsStore.getState().setLoading(true)
        setError(null)
        try {
            const res = await fetch(`${getServerUrl()}/api/campaigns/${campaignId}/items`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const items = await res.json() as Item[]
            useItemsStore.getState().setItems(items)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load items')
        } finally {
            setLoading(false)
            useItemsStore.getState().setLoading(false)
        }
    }, [campaignId])

    useEffect(() => { void fetchItems() }, [fetchItems])
    return { loading, error, refetch: fetchItems }
}

export async function postItem(
    campaignId: string,
    data: { name: string; description?: string; rarity?: string | null; category?: string | null; properties?: string[]; tags?: string[]; sourceNoteId?: string | null },
): Promise<Item> {
    const r = await fetch(`${getServerUrl()}/api/campaigns/${campaignId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Item>
}

export async function patchItem(
    id: string,
    data: Partial<Pick<Item, 'name' | 'description' | 'rarity' | 'category' | 'properties' | 'tags' | 'sourceNoteId'>>,
): Promise<Item> {
    const r = await fetch(`${getServerUrl()}/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<Item>
}

export async function deleteItem(id: string): Promise<void> {
    const r = await fetch(`${getServerUrl()}/api/items/${id}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
}
