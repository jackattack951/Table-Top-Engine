/**
 * Media detail panel — right side panel showing asset preview, metadata, and controls.
 */
import React, { useState } from 'react'
import { getAssetFileUrl } from '../../hooks/use-assets'
import type { MediaAsset, UpdateAssetInput, AssetCategory, PlaybackMode } from '@shared/asset-types'

const ALL_CATEGORIES: AssetCategory[] = ['background', 'gameboard', 'character', 'item']
const PLAYBACK_MODES: { value: PlaybackMode; label: string }[] = [
    { value: 'loop', label: 'Loop' },
    { value: 'once', label: 'Play Once' },
    { value: 'freeze', label: 'Freeze Last Frame' },
]

interface MediaDetailPanelProps {
    asset: MediaAsset
    onUpdate: (data: UpdateAssetInput) => void
    onDelete: () => void
    onClose: () => void
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaDetailPanel({ asset, onUpdate, onDelete, onClose }: MediaDetailPanelProps): React.JSX.Element {
    const [editName, setEditName] = useState(asset.fileName)
    const [tagInput, setTagInput] = useState('')
    const [tagDuplicate, setTagDuplicate] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const fileUrl = getAssetFileUrl(asset.id)

    function handleNameSave(): void {
        if (editName.trim() && editName !== asset.fileName) {
            onUpdate({ fileName: editName.trim() })
        }
    }

    function toggleCategory(cat: AssetCategory): void {
        const has = asset.categories.includes(cat)
        const updated = has
            ? asset.categories.filter((c) => c !== cat)
            : [...asset.categories, cat]
        onUpdate({ categories: updated })
    }

    function handleAddTag(): void {
        const tag = tagInput.trim()
        if (!tag) return
        if (asset.tags.includes(tag)) {
            setTagDuplicate(true)
            return
        }
        setTagDuplicate(false)
        onUpdate({ tags: [...asset.tags, tag] })
        setTagInput('')
    }

    function handleRemoveTag(tag: string): void {
        onUpdate({ tags: asset.tags.filter((t) => t !== tag) })
    }

    return (
        <div className="media-detail">
            <div className="media-detail__header">
                <span className="media-detail__title">Details</span>
                <button className="media-detail__close" onClick={onClose} aria-label="Close detail panel">
                    {'\u2715'}
                </button>
            </div>

            {/* Preview */}
            <div className="media-detail__preview">
                {asset.mediaType === 'image' && (
                    <img className="media-detail__preview-img" src={fileUrl} alt={asset.fileName} />
                )}
                {asset.mediaType === 'video' && (
                    <video className="media-detail__preview-video" src={fileUrl} controls muted loop />
                )}
                {asset.mediaType === 'audio' && (
                    <audio className="media-detail__preview-audio" src={fileUrl} controls />
                )}
            </div>

            {/* Filename */}
            <div className="media-detail__field">
                <label className="media-detail__label">Name</label>
                <div className="media-detail__name-row">
                    <input
                        className="form-input media-detail__name-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleNameSave}
                        onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                    />
                </div>
            </div>

            {/* Metadata */}
            <div className="media-detail__field">
                <label className="media-detail__label">Info</label>
                <div className="media-detail__meta">
                    <span>{asset.mediaType}</span>
                    <span>{formatFileSize(asset.fileSize)}</span>
                    {asset.width && asset.height && (
                        <span>{asset.width} x {asset.height}</span>
                    )}
                    {asset.duration != null && (
                        <span>{asset.duration.toFixed(1)}s</span>
                    )}
                </div>
            </div>

            {/* Categories */}
            <div className="media-detail__field">
                <label className="media-detail__label">Categories</label>
                <div className="media-detail__cat-pills">
                    {ALL_CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            className={`media-filter__pill${asset.categories.includes(cat) ? ' media-filter__pill--active' : ''}`}
                            onClick={() => toggleCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Playback mode (video/audio only) */}
            {(asset.mediaType === 'video' || asset.mediaType === 'audio') && (
                <div className="media-detail__field">
                    <label className="media-detail__label">Playback</label>
                    <select
                        className="form-select"
                        value={asset.playbackMode}
                        onChange={(e) => onUpdate({ playbackMode: e.target.value as PlaybackMode })}
                    >
                        {PLAYBACK_MODES.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Tags */}
            <div className="media-detail__field">
                <label className="media-detail__label">Tags</label>
                <div className="media-detail__tags">
                    {asset.tags.map((tag) => (
                        <span key={tag} className="media-detail__tag">
                            {tag}
                            <button
                                className="media-detail__tag-remove"
                                onClick={() => handleRemoveTag(tag)}
                                aria-label={`Remove tag ${tag}`}
                            >
                                {'\u2715'}
                            </button>
                        </span>
                    ))}
                    <input
                        className={`form-input media-detail__tag-input${tagDuplicate ? ' media-detail__tag-input--duplicate' : ''}`}
                        placeholder={tagDuplicate ? 'Tag already exists' : 'Add tag...'}
                        value={tagInput}
                        onChange={(e) => { setTagInput(e.target.value); setTagDuplicate(false) }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                </div>
            </div>

            {/* Delete */}
            <div className="media-detail__actions">
                {confirmDelete ? (
                    <div className="media-detail__confirm-row">
                        <span>Delete this asset?</span>
                        <button className="btn btn-danger btn-sm" onClick={onDelete}>Confirm</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                    </div>
                ) : (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                        Delete Asset
                    </button>
                )}
            </div>
        </div>
    )
}
