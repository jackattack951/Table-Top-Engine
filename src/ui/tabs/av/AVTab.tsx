import React from 'react'
import { AVToolbar } from './av-toolbar'
import { GBSettingsZone } from './gb-settings-zone'
import { BGSettingsZone } from './bg-settings-zone'

interface AVTabProps {
    onNavigateToSettings?: () => void
}

export function AVTab({ onNavigateToSettings }: AVTabProps): React.JSX.Element {
    return (
        <div className="tab-panel">
            <div className="av-tab">
                <AVToolbar onNavigateToSettings={onNavigateToSettings} />
                <div className="av-tab__columns">
                    <div className="av-tab__column">
                        <span className="av-tab__column-label">Game Board</span>
                        <GBSettingsZone />
                    </div>
                    <div className="av-tab__column">
                        <span className="av-tab__column-label">Background</span>
                        <BGSettingsZone />
                    </div>
                </div>
            </div>
        </div>
    )
}
