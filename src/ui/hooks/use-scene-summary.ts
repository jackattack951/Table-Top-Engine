/**
 * useSceneSummary — Sprint 22a.
 * Lazy-fetches aggregated scene data from GET /api/scenes/:id/summary.
 * Caches by sceneId — only re-fetches when the sceneId changes.
 */
import { useState, useEffect } from 'react'
import { getServerUrl } from '../lib/sync'
import type { Scene, NPC, Note, SceneItem } from '@core/types'
import type { MediaAsset } from '@shared/asset-types'

export interface SceneSummaryResponse {
    scene: Scene
    npcs: NPC[]
    notes: Note[]
    items: SceneItem[]
    bgAsset: Pick<MediaAsset, 'fileName' | 'mediaType'> | null
    gbAsset: Pick<MediaAsset, 'fileName' | 'mediaType'> | null
}

export function useSceneSummary(sceneId: string | null): {
    summary: SceneSummaryResponse | null
    loading: boolean
    error: string | null
} {
    const [summary, setSummary] = useState<SceneSummaryResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!sceneId) {
            setSummary(null)
            setError(null)
            return
        }

        setLoading(true)
        setError(null)

        const controller = new AbortController()

        fetch(`${getServerUrl()}/api/scenes/${sceneId}/summary`, { signal: controller.signal })
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                return r.json() as Promise<SceneSummaryResponse>
            })
            .then((data) => {
                setSummary(data)
                setLoading(false)
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError') return
                setError('Failed to load summary')
                setLoading(false)
            })

        return () => controller.abort()
    }, [sceneId])

    return { summary, loading, error }
}
