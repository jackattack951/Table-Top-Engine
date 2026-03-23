/**
 * ExtractionPreview — Sprint 15h.
 * Shows a categorized checklist of entities extracted from a document.
 * DM can toggle, edit, and confirm before importing.
 */
import React, { useState, useCallback, useMemo } from 'react'
import type { ExtractionResult, ExtractedEntity } from '@systems/import/document-parser'

interface ExtractionPreviewProps {
    result: ExtractionResult
    onImport: (entities: ExtractedEntity[], updatedExtraction: ExtractionResult) => void
    onCancel: () => void
    importing: boolean
}

interface CategorySectionProps {
    label: string
    entities: ExtractedEntity[]
    onToggle: (key: string) => void
    onToggleAll: (checked: boolean) => void
    onEditTitle: (key: string, title: string) => void
}

function CategorySection({ label, entities, onToggle, onToggleAll, onEditTitle }: CategorySectionProps) {
    const [expanded, setExpanded] = useState(true)
    const checkedCount = entities.filter((e) => e.checked).length
    const allChecked = checkedCount === entities.length
    const someChecked = checkedCount > 0 && !allChecked

    if (entities.length === 0) return null

    return (
        <div className="extraction-category">
            <div className="extraction-category__header" onClick={() => setExpanded(!expanded)}>
                <label
                    className="extraction-category__check"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => {
                            if (el) el.indeterminate = someChecked
                        }}
                        onChange={() => onToggleAll(!allChecked)}
                    />
                </label>
                <span className="extraction-category__expand">
                    {expanded ? '\u25BC' : '\u25B6'}
                </span>
                <span className="extraction-category__label">{label}</span>
                <span className="extraction-category__count">
                    {checkedCount}/{entities.length}
                </span>
            </div>

            {expanded && (
                <div className="extraction-category__items">
                    {entities.map((entity) => (
                        <EntityRow
                            key={entity.key}
                            entity={entity}
                            onToggle={onToggle}
                            onEditTitle={onEditTitle}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

interface EntityRowProps {
    entity: ExtractedEntity
    onToggle: (key: string) => void
    onEditTitle: (key: string, title: string) => void
}

function EntityRow({ entity, onToggle, onEditTitle }: EntityRowProps) {
    const [editing, setEditing] = useState(false)
    const [editValue, setEditValue] = useState(entity.title)

    const handleSaveEdit = useCallback(() => {
        onEditTitle(entity.key, editValue.trim() || entity.title)
        setEditing(false)
    }, [entity.key, entity.title, editValue, onEditTitle])

    const metaStr = buildMetaString(entity)

    return (
        <div className={`extraction-entity ${entity.checked ? '' : 'extraction-entity--unchecked'}`}>
            <label className="extraction-entity__check">
                <input
                    type="checkbox"
                    checked={entity.checked}
                    onChange={() => onToggle(entity.key)}
                />
            </label>

            <div className="extraction-entity__info">
                {editing ? (
                    <input
                        className="form-input extraction-entity__edit-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') { setEditValue(entity.title); setEditing(false) }
                        }}
                        autoFocus
                    />
                ) : (
                    <span
                        className="extraction-entity__title"
                        onDoubleClick={() => { setEditValue(entity.title); setEditing(true) }}
                    >
                        {entity.title}
                    </span>
                )}
                {metaStr && <span className="extraction-entity__meta">{metaStr}</span>}
            </div>

            {entity.relationships.length > 0 && (
                <span className="extraction-entity__links" title={`${entity.relationships.length} cross-reference(s)`}>
                    {entity.relationships.length}
                </span>
            )}
        </div>
    )
}

function buildMetaString(entity: ExtractedEntity): string {
    const parts: string[] = []
    const m = entity.metadata

    if (entity.type === 'npc') {
        if (m['race']) parts.push(m['race'] as string)
        if (m['class']) parts.push(m['class'] as string)
        if (m['alignment']) parts.push(m['alignment'] as string)
    } else if (entity.type === 'item') {
        if (m['rarity']) parts.push(m['rarity'] as string)
        if (m['parenthetical']) parts.push(m['parenthetical'] as string)
    } else if (entity.type === 'scene') {
        if (m['locationName']) parts.push(m['locationName'] as string)
    }

    return parts.join(', ')
}

export function ExtractionPreview({ result, onImport, onCancel, importing }: ExtractionPreviewProps): React.JSX.Element {
    // Local mutable copy of entities for toggle/edit
    const [scenes, setScenes] = useState(result.scenes)
    const [npcs, setNpcs] = useState(result.npcs)
    const [items, setItems] = useState(result.items)
    const [locations, setLocations] = useState(result.locations)
    const [factions, setFactions] = useState(result.factions)
    const [lore, setLore] = useState(result.lore)

    const allCategories = useMemo(() => [
        { label: 'Scenes', entities: scenes, setter: setScenes },
        { label: 'NPCs', entities: npcs, setter: setNpcs },
        { label: 'Items', entities: items, setter: setItems },
        { label: 'Locations', entities: locations, setter: setLocations },
        { label: 'Factions', entities: factions, setter: setFactions },
        { label: 'Lore', entities: lore, setter: setLore },
    ] as Array<{
        label: string
        entities: ExtractedEntity[]
        setter: React.Dispatch<React.SetStateAction<ExtractedEntity[]>>
    }>, [scenes, npcs, items, locations, factions, lore])

    const toggleEntity = useCallback((key: string) => {
        for (const cat of allCategories) {
            const idx = cat.entities.findIndex((e) => e.key === key)
            if (idx !== -1) {
                cat.setter((prev) => prev.map((e) =>
                    e.key === key ? { ...e, checked: !e.checked } : e
                ))
                return
            }
        }
    }, [allCategories])

    const editTitle = useCallback((key: string, title: string) => {
        for (const cat of allCategories) {
            const idx = cat.entities.findIndex((e) => e.key === key)
            if (idx !== -1) {
                cat.setter((prev) => prev.map((e) =>
                    e.key === key ? { ...e, title } : e
                ))
                return
            }
        }
    }, [allCategories])

    const checkedTotal = [...scenes, ...npcs, ...items, ...locations, ...factions, ...lore]
        .filter((e) => e.checked).length

    const handleImport = useCallback(() => {
        const checked = [...scenes, ...npcs, ...items, ...locations, ...factions, ...lore]
            .filter((e) => e.checked)
        const updatedExtraction: ExtractionResult = {
            scenes, npcs, items, locations, factions, lore,
            total: result.total,
        }
        onImport(checked, updatedExtraction)
    }, [scenes, npcs, items, locations, factions, lore, result.total, onImport])

    return (
        <div className="extraction-preview">
            <div className="extraction-preview__header">
                <h3 className="extraction-preview__title">Extraction Preview</h3>
                <span className="extraction-preview__total">
                    {checkedTotal} of {result.total} entities selected
                </span>
            </div>

            <div className="extraction-preview__body">
                {result.total === 0 ? (
                    <div className="extraction-preview__empty">
                        No entities detected. The parser looks for structured headings like
                        "## Scene 1:", "**NPC — Name**", item lists, etc.
                    </div>
                ) : (
                    allCategories.map(({ label, entities, setter }) => (
                        <CategorySection
                            key={label}
                            label={label}
                            entities={entities}
                            onToggle={toggleEntity}
                            onToggleAll={(checked) => {
                                setter((prev) => prev.map((e) => ({ ...e, checked })))
                            }}
                            onEditTitle={editTitle}
                        />
                    ))
                )}
            </div>

            <div className="extraction-preview__actions">
                <button
                    className="btn btn-ghost"
                    onClick={onCancel}
                    disabled={importing}
                >
                    Cancel
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={importing || checkedTotal === 0}
                >
                    {importing ? 'Importing…' : `Import ${checkedTotal} Entities`}
                </button>
            </div>
        </div>
    )
}
