/**
 * Media grid — displays asset cards in grid or list layout.
 * Reusable in both the Media Library tab and the Media Picker modal.
 */
import React from 'react'
import { AssetCard } from './asset-card'
import type { MediaAsset } from '@shared/asset-types'

interface MediaGridProps {
    assets: MediaAsset[]
    selectedId: string | null
    viewMode: 'grid' | 'list'
    onSelect: (asset: MediaAsset) => void
}

export function MediaGrid({ assets, selectedId, viewMode, onSelect }: MediaGridProps): React.JSX.Element {
    return (
        <div className={`media-grid media-grid--${viewMode}`}>
            {assets.map((asset) => (
                <AssetCard
                    key={asset.id}
                    asset={asset}
                    selected={asset.id === selectedId}
                    compact={viewMode === 'list'}
                    onClick={() => onSelect(asset)}
                />
            ))}
        </div>
    )
}
