/**
 * Media filter bar — search, type pills, category pills, view toggle.
 */
import React from 'react'
import type { AssetFilter, MediaType, AssetCategory } from '@shared/asset-types'

const MEDIA_TYPES: { value: MediaType; label: string }[] = [
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'audio', label: 'Audio' },
]

const CATEGORIES: { value: AssetCategory; label: string }[] = [
    { value: 'background', label: 'BG' },
    { value: 'gameboard', label: 'GB' },
    { value: 'character', label: 'Character' },
    { value: 'item', label: 'Item' },
]

interface MediaFilterBarProps {
    filter: AssetFilter
    onFilterChange: (filter: AssetFilter) => void
    viewMode: 'grid' | 'list'
    onViewModeChange: (mode: 'grid' | 'list') => void
}

export function MediaFilterBar({ filter, onFilterChange, viewMode, onViewModeChange }: MediaFilterBarProps): React.JSX.Element {
    function toggleType(type: MediaType): void {
        onFilterChange({
            ...filter,
            mediaType: filter.mediaType === type ? undefined : type,
        })
    }

    function toggleCategory(cat: AssetCategory): void {
        onFilterChange({
            ...filter,
            category: filter.category === cat ? undefined : cat,
        })
    }

    return (
        <div className="media-filter">
            <input
                className="form-input media-filter__search"
                type="text"
                placeholder="Search assets..."
                value={filter.search ?? ''}
                onChange={(e) => onFilterChange({ ...filter, search: e.target.value || undefined })}
            />

            <div className="media-filter__pills">
                {MEDIA_TYPES.map((t) => (
                    <button
                        key={t.value}
                        className={`media-filter__pill${filter.mediaType === t.value ? ' media-filter__pill--active' : ''}`}
                        onClick={() => toggleType(t.value)}
                    >
                        {t.label}
                    </button>
                ))}

                <span className="media-filter__divider" />

                {CATEGORIES.map((c) => (
                    <button
                        key={c.value}
                        className={`media-filter__pill${filter.category === c.value ? ' media-filter__pill--active' : ''}`}
                        onClick={() => toggleCategory(c.value)}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            <div className="media-filter__view-toggle">
                <button
                    className={`media-filter__view-btn${viewMode === 'grid' ? ' media-filter__view-btn--active' : ''}`}
                    onClick={() => onViewModeChange('grid')}
                    title="Grid view"
                    aria-label="Grid view"
                >
                    {'\u2588\u2588'}
                </button>
                <button
                    className={`media-filter__view-btn${viewMode === 'list' ? ' media-filter__view-btn--active' : ''}`}
                    onClick={() => onViewModeChange('list')}
                    title="List view"
                    aria-label="List view"
                >
                    {'\u2630'}
                </button>
            </div>
        </div>
    )
}
