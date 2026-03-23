/**
 * Media Library Zustand store.
 * Tracks asset list, selected asset, filter state, and view mode.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { MediaAsset, AssetFilter } from '@shared/asset-types'

interface MediaState {
    assets: MediaAsset[]
    selectedAssetId: string | null
    filter: AssetFilter
    viewMode: 'grid' | 'list'
    isImporting: boolean

    setAssets: (assets: MediaAsset[]) => void
    addAsset: (asset: MediaAsset) => void
    updateAsset: (id: string, patch: Partial<MediaAsset>) => void
    removeAsset: (id: string) => void
    setSelectedAssetId: (id: string | null) => void
    setFilter: (filter: AssetFilter) => void
    setViewMode: (mode: 'grid' | 'list') => void
    setImporting: (importing: boolean) => void
    reset: () => void
}

const INITIAL_STATE = {
    assets: [] as MediaAsset[],
    selectedAssetId: null as string | null,
    filter: {} as AssetFilter,
    viewMode: 'grid' as const,
    isImporting: false,
}

export const useMediaStore = create<MediaState>()(
    subscribeWithSelector((set) => ({
        ...INITIAL_STATE,

        setAssets: (assets) => set({ assets }),

        addAsset: (asset) => set((s) => ({ assets: [asset, ...s.assets] })),

        updateAsset: (id, patch) => set((s) => ({
            assets: s.assets.map((a) => a.id === id ? { ...a, ...patch } : a),
        })),

        removeAsset: (id) => set((s) => ({
            assets: s.assets.filter((a) => a.id !== id),
            selectedAssetId: s.selectedAssetId === id ? null : s.selectedAssetId,
        })),

        setSelectedAssetId: (id) => set({ selectedAssetId: id }),
        setFilter: (filter) => set({ filter }),
        setViewMode: (mode) => set({ viewMode: mode }),
        setImporting: (importing) => set({ isImporting: importing }),
        reset: () => set(INITIAL_STATE),
    }))
)
