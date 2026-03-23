/**
 * Media Library Tab — browse, import, and manage media assets.
 * 2-column layout: filter bar + grid on left, detail panel on right.
 */
import React, { useState, useCallback } from 'react'
import { useMediaStore } from '../../stores/media-store'
import { useAssets, postAsset, patchAsset, deleteAssetAPI } from '../../hooks/use-assets'
import { MediaFilterBar } from './media-filter-bar'
import { MediaGrid } from './media-grid'
import { MediaDetailPanel } from './media-detail-panel'
import { MediaImportButton } from './media-import-button'
import type { MediaAsset, AssetFilter, UpdateAssetInput } from '@shared/asset-types'

export function MediaTab(): React.JSX.Element {
    const { filter, setFilter, viewMode, setViewMode, selectedAssetId, setSelectedAssetId } = useMediaStore()
    const { assets, loading, error, refetch } = useAssets(filter)
    const [detailAsset, setDetailAsset] = useState<MediaAsset | null>(null)

    function handleSelect(asset: MediaAsset): void {
        setSelectedAssetId(asset.id)
        setDetailAsset(asset)
    }

    function handleFilterChange(newFilter: AssetFilter): void {
        setFilter(newFilter)
        setSelectedAssetId(null)
        setDetailAsset(null)
    }

    const handleImportComplete = useCallback(async () => {
        await refetch()
    }, [refetch])

    async function handleUpdate(id: string, data: UpdateAssetInput): Promise<void> {
        try {
            const updated = await patchAsset(id, data)
            if (detailAsset?.id === id) setDetailAsset(updated)
            await refetch()
        } catch (err) {
            console.error('[MediaTab] update error:', err)
        }
    }

    async function handleDelete(id: string): Promise<void> {
        try {
            await deleteAssetAPI(id)
            if (selectedAssetId === id) {
                setSelectedAssetId(null)
                setDetailAsset(null)
            }
            await refetch()
        } catch (err) {
            console.error('[MediaTab] delete error:', err)
        }
    }

    return (
        <div className="tab-panel">
            <div className="media-tab">
                {/* Header: filter bar + import */}
                <div className="media-tab__header">
                    <MediaFilterBar
                        filter={filter}
                        onFilterChange={handleFilterChange}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />
                    <MediaImportButton onImportComplete={handleImportComplete} />
                </div>

                {/* Content: grid + detail */}
                <div className="media-tab__body">
                    <div className="media-tab__grid-area">
                        {loading && (
                            <p className="media-tab__status loading-spinner">Loading assets…</p>
                        )}
                        {error && (
                            <p className="media-tab__status media-tab__status--error">{error}</p>
                        )}
                        {!loading && !error && assets.length === 0 && (
                            <div className="tab-placeholder tab-placeholder--compact">
                                <span className="tab-placeholder__icon">&#127910;</span>
                                <div className="tab-placeholder__title">No media assets</div>
                                <p className="tab-placeholder__desc">
                                    Click <strong>Import</strong> to add images, videos, or audio files.
                                </p>
                            </div>
                        )}
                        {!loading && !error && assets.length > 0 && (
                            <MediaGrid
                                assets={assets}
                                selectedId={selectedAssetId}
                                viewMode={viewMode}
                                onSelect={handleSelect}
                            />
                        )}
                    </div>

                    {detailAsset && (
                        <MediaDetailPanel
                            asset={detailAsset}
                            onUpdate={(data) => void handleUpdate(detailAsset.id, data)}
                            onDelete={() => void handleDelete(detailAsset.id)}
                            onClose={() => { setDetailAsset(null); setSelectedAssetId(null) }}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
