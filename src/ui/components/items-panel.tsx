/**
 * ItemsPanel — two-column items management UI.
 * Left: searchable/filterable items list. Right: item editor or empty state.
 * Sprint 15g.
 */
import React, { useState, useMemo, useCallback, useRef } from 'react'
import { useAppStore } from '../stores/app-store'
import { useItemsStore } from '../stores/items-store'
import { useItems, postItem, patchItem, deleteItem } from '../hooks/use-items'
import { emitItemCreate, emitItemUpdate, emitItemDelete } from '../lib/sync'
import type { Item, ItemRarity, ItemCategory } from '@core/types'
import { ITEM_RARITIES, ITEM_CATEGORIES } from '@core/types'

const CATEGORY_LABELS: Record<ItemCategory, string> = {
    weapon: 'Weapon',
    armor: 'Armor',
    potion: 'Potion',
    scroll: 'Scroll',
    wondrous: 'Wondrous',
    ring: 'Ring',
    staff: 'Staff',
    wand: 'Wand',
    quest: 'Quest',
    tool: 'Tool',
    other: 'Other',
}

function formatRarity(r: ItemRarity): string {
    return r === 'very-rare' ? 'Very Rare' : r.charAt(0).toUpperCase() + r.slice(1)
}

// ── Items List (left column) ─────────────────────────────────────────────────

interface ItemsListProps {
    items: Item[]
    activeItemId: string | null
    onSelect: (id: string) => void
    onCreate: () => void
}

function ItemsList({ items, activeItemId, onSelect, onCreate }: ItemsListProps) {
    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState<ItemCategory | 'all'>('all')
    const [filterRarity, setFilterRarity] = useState<ItemRarity | 'all'>('all')

    const filtered = useMemo(() => {
        let list = items
        if (search) {
            const q = search.toLowerCase()
            list = list.filter((i) =>
                i.name.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q) ||
                i.tags.some((t) => t.toLowerCase().includes(q))
            )
        }
        if (filterCategory !== 'all') {
            list = list.filter((i) => i.category === filterCategory)
        }
        if (filterRarity !== 'all') {
            list = list.filter((i) => i.rarity === filterRarity)
        }
        return list.sort((a, b) => a.name.localeCompare(b.name))
    }, [items, search, filterCategory, filterRarity])

    return (
        <div className="items-list">
            <div className="items-list__toolbar">
                <input
                    className="form-input items-list__search"
                    type="text"
                    placeholder="Search items…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="btn btn-primary items-list__create-btn" onClick={onCreate}>
                    + Item
                </button>
            </div>

            <div className="items-list__filters">
                <select
                    className="form-select"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as ItemCategory | 'all')}
                >
                    <option value="all">All Categories</option>
                    {ITEM_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                </select>
                <select
                    className="form-select"
                    value={filterRarity}
                    onChange={(e) => setFilterRarity(e.target.value as ItemRarity | 'all')}
                >
                    <option value="all">All Rarities</option>
                    {ITEM_RARITIES.map((r) => (
                        <option key={r} value={r}>{formatRarity(r)}</option>
                    ))}
                </select>
            </div>

            <div className="items-list__items">
                {filtered.length === 0 && (
                    <p className="items-list__empty">
                        {items.length === 0 ? 'No items yet. Create one!' : 'No items match your filters.'}
                    </p>
                )}
                {filtered.map((item) => (
                    <button
                        key={item.id}
                        className={`items-list__item ${item.id === activeItemId ? 'active' : ''}`}
                        onClick={() => onSelect(item.id)}
                    >
                        <span
                            className={`items-list__item-rarity-dot rarity-dot--${item.rarity ?? 'common'}`}
                        />
                        <span className="items-list__item-name">{item.name}</span>
                        {item.category && (
                            <span className="items-list__item-category">{CATEGORY_LABELS[item.category]}</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}

// ── Item Editor (right column) ───────────────────────────────────────────────

interface ItemEditorProps {
    item: Item
    onSave: (id: string, patch: Partial<Pick<Item, 'name' | 'description' | 'rarity' | 'category' | 'properties' | 'tags'>>) => void
    onDelete: (id: string) => void
}

function ItemEditor({ item, onSave, onDelete }: ItemEditorProps) {
    const [name, setName] = useState(item.name)
    const [description, setDescription] = useState(item.description)
    const [rarity, setRarity] = useState<ItemRarity | ''>(item.rarity ?? '')
    const [category, setCategory] = useState<ItemCategory | ''>(item.category ?? '')
    const [tagsStr, setTagsStr] = useState(item.tags.join(', '))
    const [propsStr, setPropsStr] = useState(item.properties.join(', '))

    // Keep refs in sync for select-change saves that need latest text values
    const nameRef = useRef(name)
    const descriptionRef = useRef(description)
    const tagsStrRef = useRef(tagsStr)
    const propsStrRef = useRef(propsStr)
    nameRef.current = name
    descriptionRef.current = description
    tagsStrRef.current = tagsStr
    propsStrRef.current = propsStr

    // Reset form when item changes
    React.useEffect(() => {
        setName(item.name)
        setDescription(item.description)
        setRarity(item.rarity ?? '')
        setCategory(item.category ?? '')
        setTagsStr(item.tags.join(', '))
        setPropsStr(item.properties.join(', '))
    }, [item.id, item.name, item.description, item.rarity, item.category, item.tags, item.properties])

    /** Gather all current form state and save */
    const saveAll = useCallback((overrides?: { rarity?: ItemRarity | ''; category?: ItemCategory | '' }) => {
        const tags = tagsStrRef.current.split(',').map((t) => t.trim()).filter(Boolean)
        const properties = propsStrRef.current.split(',').map((p) => p.trim()).filter(Boolean)
        onSave(item.id, {
            name: nameRef.current.trim() || 'Untitled Item',
            description: descriptionRef.current,
            rarity: (overrides?.rarity ?? rarity) || null,
            category: (overrides?.category ?? category) || null,
            tags,
            properties,
        })
    }, [item.id, rarity, category, onSave])

    // Auto-save on blur
    const onBlur = useCallback(() => {
        saveAll()
    }, [saveAll])

    return (
        <div className="item-editor">
            <div className="item-editor__header">
                <input
                    className="form-input item-editor__name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={onBlur}
                    placeholder="Item name"
                />
                <button
                    className="btn btn-danger item-editor__delete"
                    onClick={() => onDelete(item.id)}
                >
                    Delete
                </button>
            </div>

            <div className="item-editor__meta">
                <div className="item-editor__field">
                    <label className="item-editor__label">Category</label>
                    <select
                        className="form-select"
                        value={category}
                        onChange={(e) => {
                            const newCat = e.target.value as ItemCategory | ''
                            setCategory(newCat)
                            saveAll({ category: newCat })
                        }}
                    >
                        <option value="">None</option>
                        {ITEM_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                        ))}
                    </select>
                </div>

                <div className="item-editor__field">
                    <label className="item-editor__label">Rarity</label>
                    <select
                        className="form-select"
                        value={rarity}
                        onChange={(e) => {
                            const newRar = e.target.value as ItemRarity | ''
                            setRarity(newRar)
                            saveAll({ rarity: newRar })
                        }}
                    >
                        <option value="">None</option>
                        {ITEM_RARITIES.map((r) => (
                            <option key={r} value={r}>{formatRarity(r)}</option>
                        ))}
                    </select>
                    {rarity && (
                        <span
                            className={`item-editor__rarity-badge rarity-badge--${rarity}`}
                        >
                            {formatRarity(rarity as ItemRarity)}
                        </span>
                    )}
                </div>
            </div>

            <div className="item-editor__field">
                <label className="item-editor__label">Description</label>
                <textarea
                    className="form-input item-editor__description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={onBlur}
                    placeholder="Item description…"
                    rows={5}
                />
            </div>

            <div className="item-editor__field">
                <label className="item-editor__label">Properties</label>
                <input
                    className="form-input"
                    type="text"
                    value={propsStr}
                    onChange={(e) => setPropsStr(e.target.value)}
                    onBlur={onBlur}
                    placeholder="e.g. +1, finesse, light (comma-separated)"
                />
            </div>

            <div className="item-editor__field">
                <label className="item-editor__label">Tags</label>
                <input
                    className="form-input"
                    type="text"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    onBlur={onBlur}
                    placeholder="e.g. magic, sword, cursed (comma-separated)"
                />
            </div>

            {item.tags.length > 0 && (
                <div className="item-editor__tags">
                    {item.tags.map((tag) => (
                        <span key={tag} className="item-editor__tag">{tag}</span>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export function ItemsPanel(): React.JSX.Element {
    const { activeCampaignId } = useAppStore()
    const { items, activeItemId, setActiveItemId } = useItemsStore()
    const { loading, error } = useItems(activeCampaignId)

    const activeItem = items.find((i) => i.id === activeItemId) ?? null

    const handleCreate = useCallback(async () => {
        if (!activeCampaignId) return
        try {
            const item = await postItem(activeCampaignId, { name: 'New Item' })
            useItemsStore.getState().addItem(item)
            useItemsStore.getState().setActiveItemId(item.id)
            emitItemCreate(item)
        } catch (err) {
            console.error('[ItemsPanel] create error:', err)
        }
    }, [activeCampaignId])

    const handleSave = useCallback(async (id: string, patch: Partial<Pick<Item, 'name' | 'description' | 'rarity' | 'category' | 'properties' | 'tags'>>) => {
        useItemsStore.getState().updateItem(id, patch)
        try {
            const updated = await patchItem(id, patch)
            emitItemUpdate(updated)
        } catch (err) {
            console.error('[ItemsPanel] save error:', err)
        }
    }, [])

    const handleDelete = useCallback(async (id: string) => {
        try {
            await deleteItem(id)
            useItemsStore.getState().removeItem(id)
            emitItemDelete(id)
        } catch (err) {
            console.error('[ItemsPanel] delete error:', err)
        }
    }, [])

    if (!activeCampaignId) {
        return (
            <div className="items-panel">
                <p className="items-panel__empty">
                    No active campaign. Open or create a campaign to manage items.
                </p>
            </div>
        )
    }

    return (
        <div className="items-panel">
            <div className="items-panel__sidebar">
                {loading && <p className="items-panel__status">Loading items…</p>}
                {error && <p className="items-panel__status items-panel__status--error">{error}</p>}
                {!loading && !error && (
                    <ItemsList
                        items={items}
                        activeItemId={activeItemId}
                        onSelect={setActiveItemId}
                        onCreate={() => void handleCreate()}
                    />
                )}
            </div>

            <div className="items-panel__main">
                {activeItem ? (
                    <ItemEditor
                        item={activeItem}
                        onSave={(id, patch) => void handleSave(id, patch)}
                        onDelete={(id) => void handleDelete(id)}
                    />
                ) : (
                    <div className="items-panel__placeholder">
                        <p className="items-panel__placeholder-title">Select an item</p>
                        <p>Choose an item from the list or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
