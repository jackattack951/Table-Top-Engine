/**
 * QuickAccessColumn — Right column of the dashboard 3-column layout (Sprint 10b).
 *
 * Sub-tab navigation: Combat / Spells / Items / NPC / Dice.
 * All sub-tabs wired to real components.
 */
import React, { useState } from 'react'
import { QuickCombat } from './quick-combat'
import { QuickSpells } from './quick-spells'
import { QuickItems } from './quick-items'
import { QuickNPCs } from './quick-npcs'
import { QuickDice } from './quick-dice'

type QuickTab = 'combat' | 'spells' | 'items' | 'npc' | 'dice'

const QUICK_TABS: { id: QuickTab; label: string }[] = [
    { id: 'combat', label: 'Combat' },
    { id: 'spells', label: 'Spells' },
    { id: 'items', label: 'Items' },
    { id: 'npc', label: 'NPC' },
    { id: 'dice', label: 'Dice' },
]

export function QuickAccessColumn(): React.JSX.Element {
    const [activeTab, setActiveTab] = useState<QuickTab>('combat')

    function renderContent(): React.JSX.Element {
        switch (activeTab) {
            case 'combat':
                return <QuickCombat />
            case 'spells':
                return <QuickSpells />
            case 'npc':
                return <QuickNPCs />
            case 'items':
                return <QuickItems />
            case 'dice':
                return <QuickDice />
        }
    }

    return (
        <div className="dashboard__column">
            {/* Sub-tab navigation */}
            <nav className="dashboard-subtabs" aria-label="Quick access sub-tabs">
                {QUICK_TABS.map((tab) => (
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

            <div role="tabpanel" className="quick-access__panel">
                {renderContent()}
            </div>
        </div>
    )
}
