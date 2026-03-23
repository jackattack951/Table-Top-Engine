/**
 * Media Picker — reusable modal overlay for selecting a media asset.
 * Used by scene cards, AV tab, and any future component that needs asset selection.
 * Reuses MediaGrid and MediaFilterBar from the Media Library tab.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAssets } from '../hooks/use-assets'
import { MediaGrid } from '../tabs/media/media-grid'
import { MediaFilterBar } from '../tabs/media/media-filter-bar'
import type { MediaAsset, AssetFilter, MediaType, AssetCategory } from '@shared/asset-types'

interface MediaPickerProps {
    open: boolean
    onClose: () => void
    onSelect: (asset: MediaAsset) => void
    mediaTypeFilter?: MediaType[]
    categoryFilter?: AssetCategory[]
    selectedAssetId?: string | null
    title?: string
}

export function MediaPicker({
    open,
    onClose,
    onSelect,
    mediaTypeFilter,
    categoryFilter,
    selectedAssetId,
    title = 'Select Media',
}: MediaPickerProps): React.JSX.Element | null {
    const [filter, setFilter] = useState<AssetFilter>({})
    const [selected, setSelected] = useState<string | null>(selectedAssetId ?? null)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const dialogRef = useRef<HTMLDivElement>(null)

    // Build effective filter combining props + user selections
    const effectiveFilter: AssetFilter = {
        ...filter,
        mediaType: filter.mediaType ?? (mediaTypeFilter?.length === 1 ? mediaTypeFilter[0] : undefined),
        category: filter.category ?? (categoryFilter?.length === 1 ? categoryFilter[0] : undefined),
    }

    const { assets, loading } = useAssets(open ? effectiveFilter : undefined)

    // Reset selection when opening
    useEffect(() => {
        if (open) {
            setSelected(selectedAssetId ?? null)
            setFilter({})
        }
    }, [open, selectedAssetId])

    // Escape key to close
    useEffect(() => {
        if (!open) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open, onClose])

    // Auto-focus dialog on open for accessibility
    useEffect(() => {
        if (open) dialogRef.current?.focus()
    }, [open])

    const handleSelect = useCallback((asset: MediaAsset) => {
        setSelected(asset.id)
    }, [])

    function handleConfirm(): void {
        const asset = assets.find((a) => a.id === selected)
        if (asset) {
            onSelect(asset)
            onClose()
        }
    }

    if (!open) return null

    return (
        <div className="media-picker__backdrop" onClick={onClose}>
            <div
                ref={dialogRef}
                className="media-picker"
                role="dialog"
                aria-modal="true"
                aria-labelledby="media-picker-title"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="media-picker__header">
                    <span id="media-picker-title" className="media-picker__title">{title}</span>
                    <button className="media-picker__close" onClick={onClose} aria-label="Close picker">
                        {'\u2715'}
                    </button>
                </div>

                <div className="media-picker__filter">
                    <MediaFilterBar
                        filter={filter}
                        onFilterChange={setFilter}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />
                </div>

                <div className="media-picker__body">
                    {loading && <p className="media-tab__status">Loading...</p>}
                    {!loading && assets.length === 0 && (
                        <p className="media-tab__status">No matching assets. Import media in the Media tab first.</p>
                    )}
                    {!loading && assets.length > 0 && (
                        <MediaGrid
                            assets={assets}
                            selectedId={selected}
                            viewMode={viewMode}
                            onSelect={handleSelect}
                        />
                    )}
                </div>

                <div className="media-picker__footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleConfirm} disabled={!selected}>
                        Select
                    </button>
                </div>
            </div>
        </div>
    )
}
