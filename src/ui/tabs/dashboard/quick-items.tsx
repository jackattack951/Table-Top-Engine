/**
 * QuickItems — scene-linked items panel for the Dashboard right column.
 * Shows items linked to the active scene with compact cards.
 * Updated Sprint 17c: item status (hidden/loot/acquired) per scene.
 */
import React, { useState, useEffect } from 'react'
import { useSceneStore } from '../../stores/scene-store'
import { useAppStore } from '../../stores/app-store'
import { useItemsStore } from '../../stores/items-store'
import { useSceneItems } from '../../hooks/use-scene-items'
import type { SceneItem, ItemStatus } from '@core/types'

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ItemStatus, { label: string; className: string; next: ItemStatus }> = {
    hidden: { label: 'Hidden', className: 'quick-item__status--hidden', next: 'loot' },
    loot: { label: 'Loot', className: 'quick-item__status--loot', next: 'acquired' },
    acquired: { label: 'Acquired', className: 'quick-item__status--acquired', next: 'hidden' },
}

// ── Compact Item Card ─────────────────────────────────────────────────────────

function QuickItemCard({ item, onUnlink, onStatusChange }: {
    item: SceneItem
    onUnlink: (itemId: string) => void
    onStatusChange: (itemId: string, status: ItemStatus) => void
}): React.JSX.Element {
    const desc = item.description
        ? item.description.slice(0, 80) + (item.description.length > 80 ? '...' : '')
        : null

    const statusInfo = STATUS_CONFIG[item.status]

    return (
        <div className="quick-item__card">
            <div className="quick-item__card-header">
                <span className="quick-item__name">{item.name}</span>
                {item.rarity && (
                    <span className={`quick-item__rarity campaign-home__rarity--${item.rarity}`}>
                        {item.rarity}
                    </span>
                )}
                <button
                    className={`btn btn-ghost quick-item__status-btn ${statusInfo.className}`}
                    onClick={() => onStatusChange(item.id, statusInfo.next)}
                    aria-label={`Status: ${statusInfo.label}. Click to change to ${STATUS_CONFIG[statusInfo.next].label}`}
                    title={`${statusInfo.label} — click to cycle`}
                >
                    {statusInfo.label}
                </button>
                <button
                    className="btn btn-ghost quick-item__unlink-btn"
                    onClick={() => onUnlink(item.id)}
                    aria-label={`Unlink ${item.name} from scene`}
                >
                    ×
                </button>
            </div>
            {desc && (
                <p className="quick-item__description">{desc}</p>
            )}
            {item.tags.length > 0 && (
                <div className="quick-item__tags">
                    {item.tags.map((tag) => (
                        <span key={tag} className="quick-item__tag">{tag}</span>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuickItems(): React.JSX.Element {
    const activeScene = useSceneStore((s) => s.activeScene)
    const activeCampaignId = useAppStore((s) => s.activeCampaignId)
    const allItems = useItemsStore((s) => s.items)
    const sceneId = activeScene?.id ?? null

    const { items: sceneItems, loading, error, linkItem, unlinkItem, updateStatus } = useSceneItems(sceneId)

    const [selectedItemId, setSelectedItemId] = useState('')
    const [linkError, setLinkError] = useState<string | null>(null)

    // Reset selection when scene changes
    useEffect(() => { setSelectedItemId('') }, [sceneId])

    // Filter out already-linked items from dropdown
    const linkedIds = new Set(sceneItems.map((i) => i.id))
    const availableItems = allItems.filter((i) => !linkedIds.has(i.id))

    async function handleLink() {
        if (!selectedItemId || !sceneId) return
        setLinkError(null)
        try {
            await linkItem(selectedItemId)
            setSelectedItemId('')
        } catch (err) {
            setLinkError(err instanceof Error ? err.message : 'Failed to link item')
        }
    }

    async function handleUnlink(itemId: string) {
        setLinkError(null)
        try {
            await unlinkItem(itemId)
        } catch (err) {
            setLinkError(err instanceof Error ? err.message : 'Failed to unlink item')
        }
    }

    async function handleStatusChange(itemId: string, status: ItemStatus) {
        setLinkError(null)
        try {
            await updateStatus(itemId, status)
        } catch (err) {
            setLinkError(err instanceof Error ? err.message : 'Failed to update status')
        }
    }

    if (!sceneId) {
        return (
            <div className="quick-item">
                <p className="quick-item__empty">Select a scene to view linked items</p>
            </div>
        )
    }

    return (
        <div className="quick-item">
            {loading && (
                <p className="quick-item__status">Loading...</p>
            )}
            {error && (
                <p className="quick-item__status quick-item__status--error">{error}</p>
            )}
            {linkError && (
                <p className="quick-item__status quick-item__status--error">{linkError}</p>
            )}

            {!loading && sceneItems.length === 0 && (
                <p className="quick-item__empty">No items linked to this scene</p>
            )}

            {sceneItems.map((item) => (
                <QuickItemCard
                    key={item.id}
                    item={item}
                    onUnlink={(id) => void handleUnlink(id)}
                    onStatusChange={(id, status) => void handleStatusChange(id, status)}
                />
            ))}

            {/* Link Item section */}
            {activeCampaignId && (
                <div className="quick-item__link-row">
                    <select
                        className="form-select"
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        aria-label="Select item to link"
                        disabled={availableItems.length === 0}
                    >
                        <option value="">
                            {availableItems.length === 0
                                ? 'All items linked'
                                : 'Link an item...'}
                        </option>
                        {availableItems.map((i) => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                    </select>
                    <button
                        className="btn btn-primary quick-item__link-btn"
                        onClick={() => void handleLink()}
                        disabled={!selectedItemId}
                        aria-label="Link selected item to scene"
                    >
                        Add
                    </button>
                </div>
            )}
        </div>
    )
}
