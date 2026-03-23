import React from 'react'

const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'combat', label: 'Combat' },
    { id: 'npcs', label: 'NPCs' },
    { id: 'spells', label: 'Spells' },
    { id: 'notes', label: 'Notes' },
    { id: 'media', label: 'Media' },
    { id: 'players', label: 'Players' },
    { id: 'av', label: 'AV' },
] as const

export type TabId = typeof TABS[number]['id']

interface TabBarProps {
    activeTab: TabId
    onTabChange: (tab: TabId) => void
}

export function TabBar({ activeTab, onTabChange }: TabBarProps): React.JSX.Element {
    return (
        <nav className="tab-bar" role="tablist" aria-label="Cockpit navigation">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                    className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </nav>
    )
}
