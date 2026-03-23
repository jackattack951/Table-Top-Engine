/**
 * Asset card — individual card in the media grid.
 * Shows thumbnail (or type icon fallback), filename, type badge.
 */
import React from 'react'
import { getAssetFileUrl } from '../../hooks/use-assets'
import type { MediaAsset } from '@shared/asset-types'

const TYPE_ICONS: Record<string, string> = {
    image: '\u{1F5BC}',   // framed picture
    video: '\u{1F3AC}',   // clapper board
    audio: '\u{1F3B5}',   // musical note
}

const CATEGORY_LABELS: Record<string, string> = {
    background: 'BG',
    gameboard: 'GB',
    character: 'Char',
    item: 'Item',
}

interface AssetCardProps {
    asset: MediaAsset
    selected: boolean
    compact: boolean
    onClick: () => void
}

export function AssetCard({ asset, selected, compact, onClick }: AssetCardProps): React.JSX.Element {
    const icon = TYPE_ICONS[asset.mediaType] ?? '\u{1F4C4}'

    return (
        <button
            className={`media-card${selected ? ' media-card--selected' : ''}${compact ? ' media-card--compact' : ''}`}
            onClick={onClick}
            title={asset.fileName}
        >
            <div className="media-card__thumb">
                {asset.thumbnail ? (
                    <img
                        className="media-card__thumb-img"
                        src={asset.thumbnail}
                        alt={asset.fileName}
                        loading="lazy"
                    />
                ) : asset.mediaType === 'image' ? (
                    <img
                        className="media-card__thumb-img"
                        src={getAssetFileUrl(asset.id)}
                        alt={asset.fileName}
                        loading="lazy"
                    />
                ) : (
                    <span className="media-card__thumb-icon">{icon}</span>
                )}
                <span className="media-card__type-badge">{asset.mediaType}</span>
            </div>

            <div className="media-card__info">
                <span className="media-card__name">{asset.fileName}</span>
                {asset.categories.length > 0 && (
                    <div className="media-card__categories">
                        {asset.categories.map((cat) => (
                            <span key={cat} className="media-card__cat-pill">
                                {CATEGORY_LABELS[cat] ?? cat}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </button>
    )
}
