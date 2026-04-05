/**
 * DisplayAssignmentPanel — full display assignment UI in Settings.
 * Richer than the compact av-toolbar variant: shows resolution, scale factor,
 * windowed pop-out buttons, and an empty state with instructions.
 */
import React, { useEffect, useState } from 'react'
import { useOutputStore } from '../../stores/output-store'
import { fetchDisplays } from '../../lib/sync'
import { useDisplayAssignment } from '../av/use-display-assignment'

export function DisplayAssignmentPanel(): React.JSX.Element {
    const { availableDisplays, setDisplays } = useOutputStore()
    const { getRoleForDisplay, handleRoleChange, togglePopOut, isWindowed } = useDisplayAssignment()
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

    const externalDisplays = availableDisplays.filter((d) => !d.internal)
    const bgWindowed = isWindowed('BG')
    const gbWindowed = isWindowed('GB')

    return (
        <div className="display-panel">
            {loading && <p className="settings-section__desc">Detecting displays…</p>}

            {!loading && externalDisplays.length === 0 && (
                <div className="display-panel__empty">
                    <p className="settings-section__desc">No external displays detected.</p>
                    <p className="settings-section__desc settings-section__desc--muted">
                        Connect an HDMI or DisplayPort monitor, then return here to assign it.
                    </p>
                </div>
            )}

            {!loading && externalDisplays.map((display) => (
                <div key={display.id} className="display-panel__row">
                    <div className="display-panel__info">
                        <span className="display-panel__name">{display.label}</span>
                        <span className="display-panel__meta">
                            {display.width}×{display.height}
                            {display.scaleFactor && display.scaleFactor !== 1
                                ? ` @ ${display.scaleFactor}×`
                                : ''}
                        </span>
                    </div>
                    <select
                        className="form-select display-panel__role-select"
                        value={getRoleForDisplay(display.id) ?? 'disabled'}
                        onChange={(e) => handleRoleChange(display.id, e.target.value)}
                        aria-label={`Role for ${display.label}`}
                    >
                        <option value="disabled">Off</option>
                        <option value="BG">Background (BG)</option>
                        <option value="GB">Game Board (GB)</option>
                    </select>
                </div>
            ))}

            <div className="display-panel__popouts">
                <button
                    className={`btn btn-secondary${bgWindowed ? ' active' : ''}`}
                    onClick={() => togglePopOut('BG')}
                    type="button"
                >
                    {bgWindowed ? 'Close BG Window' : 'Open BG Window'}
                </button>
                <button
                    className={`btn btn-secondary${gbWindowed ? ' active' : ''}`}
                    onClick={() => togglePopOut('GB')}
                    type="button"
                >
                    {gbWindowed ? 'Close GB Window' : 'Open GB Window'}
                </button>
            </div>
        </div>
    )
}
