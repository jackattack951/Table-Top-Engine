/**
 * CampaignHomePanel — Campaign overview when no scene is active (Sprint 16c).
 *
 * Displays global campaign content: factions, lore, items, NPCs, and a scene
 * roster for quick navigation. Shown when `activeScene === null`.
 * Read-only reference shelf during play mode.
 */
import React, { useState, useMemo } from 'react'
import { useAppStore } from '@ui/stores/app-store'
import { useNotesStore } from '@ui/stores/notes-store'
import { useItemsStore } from '@ui/stores/items-store'
import { useSceneStore } from '@ui/stores/scene-store'
import { useScenes } from '@ui/hooks/use-scenes'
import { loadScene } from '@ui/lib/sync'
import { DocumentImportModal } from '@ui/components/document-import-modal'
import type { Note, Item, Scene, NoteType } from '@core/types'

// ── Constants ────────────────────────────────────────────────────────────────

const EXCERPT_MAX_LEN = 200

const NOTE_TYPE_LABELS: Partial<Record<NoteType, string>> = {
    npc: 'NPC',
    faction: 'Faction',
    lore: 'Lore',
    location: 'Location',
    quest: 'Quest',
    session: 'Session',
    general: 'General',
    scene: 'Scene',
}

type HomeTab = 'factions' | 'lore' | 'npcs' | 'items' | 'scenes'

const HOME_TABS: { id: HomeTab; label: string }[] = [
    { id: 'scenes', label: 'Scenes' },
    { id: 'npcs', label: 'NPCs' },
    { id: 'factions', label: 'Factions' },
    { id: 'items', label: 'Items' },
    { id: 'lore', label: 'Lore' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string): string {
    return text.length > EXCERPT_MAX_LEN ? text.slice(0, EXCERPT_MAX_LEN) + '...' : text
}

// ── Component ────────────────────────────────────────────────────────────────

export function CampaignHomePanel(): React.JSX.Element {
    const campaignName = useAppStore((s) => s.activeCampaignName)
    const activeCampaignId = useAppStore((s) => s.activeCampaignId)
    const appMode = useAppStore((s) => s.appMode)
    const notes = useNotesStore((s) => s.notes)
    const items = useItemsStore((s) => s.items)
    const setActiveScene = useSceneStore((s) => s.setActiveScene)
    const { scenes, refetch: refetchScenes } = useScenes(activeCampaignId)
    const [activeTab, setActiveTab] = useState<HomeTab>('scenes')
    const [showImport, setShowImport] = useState(false)

    const isPlayMode = appMode === 'play'

    // Single-pass grouping of notes by type
    const grouped = useMemo(() => {
        const result = { factions: [] as Note[], lore: [] as Note[], npcs: [] as Note[] }
        for (const n of notes) {
            if (n.type === 'faction') result.factions.push(n)
            else if (n.type === 'lore') result.lore.push(n)
            else if (n.type === 'npc') result.npcs.push(n)
        }
        return result
    }, [notes])

    function handleSceneSelect(scene: Scene) {
        setActiveScene(scene)
        loadScene(scene.id)
    }

    return (
        <div className="campaign-home">
            {/* ── Header ────────────────────────────────────────────────── */}
            <header className="campaign-home__header">
                <h2 className="campaign-home__title">
                    {campaignName ?? 'Campaign Home'}
                </h2>
                {isPlayMode && (
                    <span className="campaign-home__badge">Reference Only</span>
                )}
                {activeCampaignId && !isPlayMode && (
                    <button
                        className="btn btn-primary campaign-home__import-btn"
                        onClick={() => setShowImport(true)}
                    >
                        Import Document
                    </button>
                )}
                <div className="campaign-home__stats">
                    <StatBadge label="Scenes" count={scenes.length} tabId="scenes" onClick={setActiveTab} />
                    <StatBadge label="NPCs" count={grouped.npcs.length} tabId="npcs" onClick={setActiveTab} />
                    <StatBadge label="Factions" count={grouped.factions.length} tabId="factions" onClick={setActiveTab} />
                    <StatBadge label="Items" count={items.length} tabId="items" onClick={setActiveTab} />
                    <StatBadge label="Lore" count={grouped.lore.length} tabId="lore" onClick={setActiveTab} />
                </div>
            </header>

            {/* ── Tab bar ───────────────────────────────────────────────── */}
            <nav className="dashboard-subtabs" aria-label="Campaign home tabs">
                {HOME_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        className={`dashboard-subtab__btn${activeTab === tab.id ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                        aria-selected={activeTab === tab.id}
                        role="tab"
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* ── Content ───────────────────────────────────────────────── */}
            <div className="campaign-home__content" role="tabpanel">
                {activeTab === 'scenes' && <SceneRoster scenes={scenes} onSelect={handleSceneSelect} />}
                {activeTab === 'npcs' && <NoteList notes={grouped.npcs} emptyMsg="No NPCs imported yet" />}
                {activeTab === 'factions' && <NoteList notes={grouped.factions} emptyMsg="No factions imported yet" />}
                {activeTab === 'items' && <ItemList items={items} />}
                {activeTab === 'lore' && <NoteList notes={grouped.lore} emptyMsg="No lore entries imported yet" />}
            </div>

            {/* ── Import modal ──────────────────────────────────────────── */}
            {showImport && activeCampaignId && (
                <DocumentImportModal
                    campaignId={activeCampaignId}
                    onClose={() => setShowImport(false)}
                    onImportComplete={() => {
                        setShowImport(false)
                        void refetchScenes()
                    }}
                />
            )}
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({ label, count, tabId, onClick }: {
    label: string
    count: number
    tabId: HomeTab
    onClick: (tab: HomeTab) => void
}): React.JSX.Element {
    return (
        <button className="campaign-home__stat" onClick={() => onClick(tabId)}>
            <span className="campaign-home__stat-count">{count}</span>
            <span className="campaign-home__stat-label">{label}</span>
        </button>
    )
}

/** Scene roster — clickable list to navigate into a scene */
function SceneRoster({ scenes, onSelect }: {
    scenes: Scene[]
    onSelect: (scene: Scene) => void
}): React.JSX.Element {
    if (scenes.length === 0) {
        return (
            <div className="campaign-home__empty">
                No scenes yet — import a document or create scenes in the Scenes tab
            </div>
        )
    }

    const sorted = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder)

    return (
        <div className="campaign-home__list">
            {sorted.map((scene) => (
                <button
                    key={scene.id}
                    className="campaign-home__scene-btn"
                    onClick={() => onSelect(scene)}
                >
                    <span className="campaign-home__scene-name">{scene.name}</span>
                    {scene.notes && (
                        <span className="campaign-home__scene-notes">
                            {scene.notes.length > 100 ? scene.notes.slice(0, 100) + '...' : scene.notes}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}

/** Renders a list of notes (factions, lore, NPCs) */
function NoteList({ notes, emptyMsg }: {
    notes: Note[]
    emptyMsg: string
}): React.JSX.Element {
    if (notes.length === 0) {
        return <div className="campaign-home__empty">{emptyMsg}</div>
    }

    return (
        <div className="campaign-home__list">
            {notes.map((note) => (
                <NoteCard key={note.id} note={note} />
            ))}
        </div>
    )
}

function NoteCard({ note }: { note: Note }): React.JSX.Element {
    const typeLabel = NOTE_TYPE_LABELS[note.type] ?? note.type

    return (
        <div className="campaign-home__card">
            <div className="campaign-home__card-header">
                <span className="campaign-home__card-title">{note.title}</span>
                <span className="campaign-home__card-type">{typeLabel}</span>
                {note.status && (
                    <span className="campaign-home__card-status">{note.status}</span>
                )}
            </div>
            {note.body && (
                <p className="campaign-home__card-body">{truncate(note.body)}</p>
            )}
            <TagList tags={note.tags} />
        </div>
    )
}

/** Renders the items list */
function ItemList({ items }: { items: Item[] }): React.JSX.Element {
    if (items.length === 0) {
        return <div className="campaign-home__empty">No items imported yet</div>
    }

    return (
        <div className="campaign-home__list">
            {items.map((item) => (
                <div key={item.id} className="campaign-home__card">
                    <div className="campaign-home__card-header">
                        <span className="campaign-home__card-title">{item.name}</span>
                        {item.rarity && (
                            <span className={`campaign-home__rarity campaign-home__rarity--${item.rarity}`}>
                                {item.rarity}
                            </span>
                        )}
                    </div>
                    {item.description && (
                        <p className="campaign-home__card-body">{truncate(item.description)}</p>
                    )}
                    <TagList tags={item.tags} />
                </div>
            ))}
        </div>
    )
}

/** Shared tag list used by both NoteCard and ItemList */
function TagList({ tags }: { tags: string[] }): React.JSX.Element | null {
    if (tags.length === 0) return null
    return (
        <div className="campaign-home__card-tags">
            {tags.map((tag) => (
                <span key={tag} className="campaign-home__tag">{tag}</span>
            ))}
        </div>
    )
}
