import React, { useEffect, useState } from 'react'
import { useOutputStore } from '../../stores/output-store'
import { fetchDisplays } from '../../lib/sync'
import { useDisplayAssignment } from './use-display-assignment'
import type { DisplayInfo } from '../../stores/output-store'

interface AVToolbarProps {
    onNavigateToSettings?: () => void
}

export function AVToolbar({ onNavigateToSettings }: AVToolbarProps): React.JSX.Element {
    const { availableDisplays, setDisplays } = useOutputStore()
    const { outputs, getRoleForDisplay, handleRoleChange, togglePopOut, isWindowed } = useDisplayAssignment()
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        void fetchDisplays().then((displays) => {
            if (!cancelled) {
                setDisplays(displays)
                setLoading(false)
            }
        })
        return () => { cancelled = true }
    }, [setDisplays])

    const externalDisplays = availableDisplays.filter((d: DisplayInfo) => !d.internal)
    const bgActive = outputs.BG !== null
    const gbActive = outputs.GB !== null

    return (
        <div className="av-toolbar">
            {/* Status indicators */}
            <div className="av-toolbar__status">
                <div className={`av-toolbar__indicator${bgActive ? ' av-toolbar__indicator--active' : ''}`}>
                    <span className="av-toolbar__dot" />
                    <span className="av-toolbar__role-label">BG</span>
                </div>
                <div className={`av-toolbar__indicator${gbActive ? ' av-toolbar__indicator--active' : ''}`}>
                    <span className="av-toolbar__dot" />
                    <span className="av-toolbar__role-label">GB</span>
                </div>
            </div>

            {/* Display assignments */}
            <div className="av-toolbar__displays">
                {loading && <span className="av-toolbar__loading">Detecting…</span>}
                {!loading && externalDisplays.map((display: DisplayInfo) => (
                    <div key={display.id} className="av-toolbar__display">
                        <span className="av-toolbar__display-name">
                            {display.label}
                            <span className="av-toolbar__display-res">{display.width}×{display.height}</span>
                        </span>
                        <select
                            className="form-select av-toolbar__role-select"
                            value={getRoleForDisplay(display.id) ?? 'disabled'}
                            onChange={(e) => handleRoleChange(display.id, e.target.value)}
                            aria-label={`Role for ${display.label}`}
                        >
                            <option value="disabled">Off</option>
                            <option value="BG">Background</option>
                            <option value="GB">Game Board</option>
                        </select>
                    </div>
                ))}
            </div>

            {/* Pop-out controls */}
            <div className="av-toolbar__popouts">
                <button
                    className={`av-toolbar__popout-btn${isWindowed('BG') ? ' active' : ''}`}
                    onClick={() => togglePopOut('BG')}
                    aria-label="Toggle BG pop-out window"
                >
                    {isWindowed('BG') ? 'Close BG' : 'Pop BG'}
                </button>
                <button
                    className={`av-toolbar__popout-btn${isWindowed('GB') ? ' active' : ''}`}
                    onClick={() => togglePopOut('GB')}
                    aria-label="Toggle GB pop-out window"
                >
                    {isWindowed('GB') ? 'Close GB' : 'Pop GB'}
                </button>
            </div>

            {onNavigateToSettings && (
                <button
                    className="btn btn-ghost av-toolbar__settings-link"
                    onClick={onNavigateToSettings}
                    type="button"
                >
                    Configure in Settings →
                </button>
            )}
        </div>
    )
}
