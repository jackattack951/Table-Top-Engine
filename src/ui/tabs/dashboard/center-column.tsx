/**
 * CenterColumn — Center column of the dashboard 3-column layout (Sprint 10b).
 *
 * Sub-tab navigation: SFX / Environment / AMB / MIX.
 * Renders SFXPanel, EnvironmentPanel, AtmosphereControl, or MixerPanel based on active sub-tab.
 */
import React, { useState } from 'react'
import { SFXPanel } from './sfx-panel'
import { EnvironmentPanel } from './environment-panel'
import { AtmosphereControl } from './atmosphere-control'
import { MixerPanel } from './mixer-panel'

type CenterTab = 'sfx' | 'environment' | 'amb' | 'mix'

const CENTER_TABS: { id: CenterTab; label: string }[] = [
    { id: 'sfx', label: 'SFX' },
    { id: 'environment', label: 'Environment' },
    { id: 'amb', label: 'AMB' },
    { id: 'mix', label: 'MIX' },
]

export function CenterColumn(): React.JSX.Element {
    const [activeTab, setActiveTab] = useState<CenterTab>('sfx')

    return (
        <div className="dashboard__column">
            {/* Sub-tab navigation */}
            <nav className="dashboard-subtabs" aria-label="Center column sub-tabs">
                {CENTER_TABS.map((tab) => (
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

            {/* Active panel */}
            <div role="tabpanel">
                {activeTab === 'sfx' && <SFXPanel />}
                {activeTab === 'environment' && <EnvironmentPanel />}
                {activeTab === 'amb' && <AtmosphereControl />}
                {activeTab === 'mix' && <MixerPanel />}
            </div>
        </div>
    )
}
