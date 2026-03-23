/**
 * ExtractEntityModal — Sprint 15i.
 * Modal shown when DM selects text and chooses "Extract as..."
 * Pre-fills fields from the selected text, lets DM edit, then creates entity.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { extractEntityFromText } from '@systems/import/entity-extractor'
import { ITEM_RARITIES, ITEM_CATEGORIES } from '@core/types'
import type { NoteType, ItemRarity, ItemCategory } from '@core/types'

export type ExtractTarget = NoteType | 'item'

interface ExtractEntityModalProps {
    /** The raw selected text from the editor */
    selectedText: string
    /** The pre-selected extraction target type */
    targetType: ExtractTarget
    /** Called when extraction is confirmed */
    onConfirm: (data: ExtractConfirmData) => void
    /** Called when modal is cancelled */
    onCancel: () => void
    /** True while the entity is being created */
    creating: boolean
}

export interface ExtractConfirmData {
    type: ExtractTarget
    title: string
    body: string
    /** NPC metadata */
    race?: string
    class?: string
    alignment?: string
    /** Item metadata */
    rarity?: ItemRarity | null
    category?: ItemCategory | null
    properties?: string[]
    tags?: string[]
}

const TYPE_LABELS: Record<ExtractTarget, string> = {
    npc: 'NPC',
    item: 'Item',
    location: 'Location',
    quest: 'Quest',
    faction: 'Faction',
    scene: 'Scene',
    lore: 'Lore',
    session: 'Session',
    general: 'General',
}

function formatRarity(r: ItemRarity): string {
    return r === 'very-rare' ? 'Very Rare' : r.charAt(0).toUpperCase() + r.slice(1)
}

export function ExtractEntityModal({
    selectedText,
    targetType: initialType,
    onConfirm,
    onCancel,
    creating,
}: ExtractEntityModalProps): React.JSX.Element {
    const [targetType, setTargetType] = useState<ExtractTarget>(initialType)

    // Parse the selected text with the current target type
    const parsed = extractEntityFromText(selectedText, targetType)

    const [title, setTitle] = useState(parsed.title)
    const [body, setBody] = useState(parsed.body)
    const [race, setRace] = useState(parsed.race ?? '')
    const [cls, setCls] = useState(parsed.class ?? '')
    const [alignment, setAlignment] = useState(parsed.alignment ?? '')
    const [rarity, setRarity] = useState<ItemRarity | ''>(parsed.rarity ?? '')
    const [category, setCategory] = useState<ItemCategory | ''>('')
    const [propsStr, setPropsStr] = useState(parsed.properties.join(', '))
    const [tagsStr, setTagsStr] = useState('')
    const hasEditedRef = useRef(false)

    // Re-parse only type-specific metadata when target type changes,
    // preserve user-edited title/body
    useEffect(() => {
        const p = extractEntityFromText(selectedText, targetType)
        if (!hasEditedRef.current) {
            setTitle(p.title)
            setBody(p.body)
        }
        setRace(p.race ?? '')
        setCls(p.class ?? '')
        setAlignment(p.alignment ?? '')
        setRarity(p.rarity ?? '')
        setPropsStr(p.properties.join(', '))
    }, [targetType, selectedText])

    const handleConfirm = useCallback(() => {
        const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean)
        const properties = propsStr.split(',').map((p) => p.trim()).filter(Boolean)

        onConfirm({
            type: targetType,
            title: title.trim() || 'Untitled',
            body,
            race: race || undefined,
            class: cls || undefined,
            alignment: alignment || undefined,
            rarity: rarity || null,
            category: category || null,
            properties,
            tags,
        })
    }, [targetType, title, body, race, cls, alignment, rarity, category, propsStr, tagsStr, onConfirm])

    const isNPC = targetType === 'npc'
    const isItem = targetType === 'item'

    return (
        <div className="extract-modal__backdrop" onClick={onCancel}>
            <div className="extract-modal" onClick={(e) => e.stopPropagation()}>
                <div className="extract-modal__header">
                    <h3 className="extract-modal__title">
                        Extract as {TYPE_LABELS[targetType]}
                    </h3>
                    <button className="extract-modal__close" onClick={onCancel}>&times;</button>
                </div>

                <div className="extract-modal__body">
                    {/* Type selector */}
                    <div className="extract-modal__field">
                        <label className="extract-modal__label">Entity Type</label>
                        <div className="extract-modal__type-pills">
                            {(['npc', 'item', 'location', 'quest', 'faction'] as ExtractTarget[]).map((t) => (
                                <button
                                    key={t}
                                    className={`extract-modal__type-pill ${targetType === t ? 'active' : ''}`}
                                    onClick={() => setTargetType(t)}
                                >
                                    {TYPE_LABELS[t]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="extract-modal__field">
                        <label className="extract-modal__label">Name</label>
                        <input
                            className="form-input"
                            value={title}
                            onChange={(e) => { hasEditedRef.current = true; setTitle(e.target.value) }}
                            placeholder="Entity name"
                            autoFocus
                        />
                    </div>

                    {/* NPC-specific fields */}
                    {isNPC && (
                        <div className="extract-modal__row">
                            <div className="extract-modal__field">
                                <label className="extract-modal__label">Race</label>
                                <input
                                    className="form-input"
                                    value={race}
                                    onChange={(e) => setRace(e.target.value)}
                                    placeholder="e.g. Human, Elf"
                                />
                            </div>
                            <div className="extract-modal__field">
                                <label className="extract-modal__label">Class</label>
                                <input
                                    className="form-input"
                                    value={cls}
                                    onChange={(e) => setCls(e.target.value)}
                                    placeholder="e.g. Fighter, Wizard"
                                />
                            </div>
                            <div className="extract-modal__field">
                                <label className="extract-modal__label">Alignment</label>
                                <input
                                    className="form-input"
                                    value={alignment}
                                    onChange={(e) => setAlignment(e.target.value)}
                                    placeholder="e.g. Neutral Good"
                                />
                            </div>
                        </div>
                    )}

                    {/* Item-specific fields */}
                    {isItem && (
                        <div className="extract-modal__row">
                            <div className="extract-modal__field">
                                <label className="extract-modal__label">Rarity</label>
                                <select
                                    className="form-select"
                                    value={rarity}
                                    onChange={(e) => setRarity(e.target.value as ItemRarity | '')}
                                >
                                    <option value="">None</option>
                                    {ITEM_RARITIES.map((r) => (
                                        <option key={r} value={r}>{formatRarity(r)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="extract-modal__field">
                                <label className="extract-modal__label">Category</label>
                                <select
                                    className="form-select"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as ItemCategory | '')}
                                >
                                    <option value="">None</option>
                                    {ITEM_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="extract-modal__field">
                                <label className="extract-modal__label">Properties</label>
                                <input
                                    className="form-input"
                                    value={propsStr}
                                    onChange={(e) => setPropsStr(e.target.value)}
                                    placeholder="e.g. attunement, cursed"
                                />
                            </div>
                        </div>
                    )}

                    {/* Body */}
                    <div className="extract-modal__field">
                        <label className="extract-modal__label">Content</label>
                        <textarea
                            className="form-input extract-modal__textarea"
                            value={body}
                            onChange={(e) => { hasEditedRef.current = true; setBody(e.target.value) }}
                            rows={6}
                        />
                    </div>

                    {/* Tags */}
                    <div className="extract-modal__field">
                        <label className="extract-modal__label">Tags</label>
                        <input
                            className="form-input"
                            value={tagsStr}
                            onChange={(e) => setTagsStr(e.target.value)}
                            placeholder="Comma-separated tags"
                        />
                    </div>
                </div>

                <div className="extract-modal__actions">
                    <button className="btn btn-ghost" onClick={onCancel} disabled={creating}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={creating || !title.trim()}
                    >
                        {creating ? 'Creating…' : `Create ${TYPE_LABELS[targetType]}`}
                    </button>
                </div>
            </div>
        </div>
    )
}
