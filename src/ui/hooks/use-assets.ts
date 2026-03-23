/**
 * Asset fetch/mutate helpers for the Media Library tab.
 * Follows the same pattern as use-scenes.ts.
 */
import { useState, useEffect, useCallback } from 'react'
import { getServerUrl } from '../lib/sync'
import type { MediaAsset, AssetFilter, CreateAssetInput, UpdateAssetInput } from '@shared/asset-types'

export function useAssets(filter?: AssetFilter) {
    const [assets, setAssets] = useState<MediaAsset[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchAssets = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            if (filter?.mediaType) params.set('mediaType', filter.mediaType)
            if (filter?.category) params.set('category', filter.category)
            if (filter?.campaignId) params.set('campaignId', filter.campaignId)
            if (filter?.search) params.set('search', filter.search)
            const qs = params.toString()
            const url = `${getServerUrl()}/api/assets${qs ? `?${qs}` : ''}`
            const r = await fetch(url)
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            setAssets(await r.json() as MediaAsset[])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load assets')
        } finally {
            setLoading(false)
        }
    }, [filter?.mediaType, filter?.category, filter?.campaignId, filter?.search])

    useEffect(() => { void fetchAssets() }, [fetchAssets])
    return { assets, loading, error, refetch: fetchAssets }
}

export async function postAsset(input: CreateAssetInput): Promise<MediaAsset> {
    const r = await fetch(`${getServerUrl()}/api/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<MediaAsset>
}

export async function patchAsset(id: string, data: UpdateAssetInput): Promise<MediaAsset> {
    const r = await fetch(`${getServerUrl()}/api/assets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json() as Promise<MediaAsset>
}

export async function deleteAssetAPI(id: string): Promise<void> {
    const r = await fetch(`${getServerUrl()}/api/assets/${id}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export async function tagAssetAPI(assetId: string, campaignId: string): Promise<void> {
    const r = await fetch(`${getServerUrl()}/api/assets/${assetId}/campaign-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

export async function untagAssetAPI(assetId: string, campaignId: string): Promise<void> {
    const r = await fetch(`${getServerUrl()}/api/assets/${assetId}/campaign-tags/${campaignId}`, {
        method: 'DELETE',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
}

/** Get the file-serving URL for an asset (for preview/playback). */
export function getAssetFileUrl(assetId: string): string {
    return `${getServerUrl()}/api/assets/${assetId}/file`
}
