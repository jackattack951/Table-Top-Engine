import React, { useEffect, useState } from 'react'
import { useOutputStore } from '../../stores/output-store'
import { emitOutputEnable, emitOutputDisable, fetchDisplays } from '../../lib/sync'
import type { DisplayInfo, OutputRole } from '../../stores/output-store'

/**
 * Compact AV output toolbar — replaces the old GlobalSettingsZone + preview zones.
 * Horizontal bar: display assignments, pop-out toggles, and live status indicators.
 */
export function AVToolbar(): React.JSX.Element {
    const { availableDisplays, outputs, setDisplays, enableOutput, disableOutput } = useOutputStore()
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

    function getRoleForDisplay(displayId: number): OutputRole | null {
        if (outputs.BG?.displayId === displayId) return 'BG'
        if (outputs.GB?.displayId === displayId) return 'GB'
        return null
    }

    function handleRoleChange(displayId: number, newRole: string): void {
        const currentRole = getRoleForDisplay(displayId)
        if (newRole === 'disabled') {
            if (currentRole) {
                disableOutput(currentRole)
                emitOutputDisable(currentRole)
            }
            return
        }
        const role = newRole as OutputRole
        if (outputs[role] && outputs[role]!.displayId !== displayId) {
            disableOutput(role)
            emitOutputDisable(role)
        }
        if (currentRole && currentRole !== role) {
            disableOutput(currentRole)
            emitOutputDisable(currentRole)
        }
        enableOutput(displayId, role)
        emitOutputEnable(displayId, role)
    }

    function handlePopOut(role: OutputRole): void {
        if (outputs[role]) {
            disableOutput(role)
            emitOutputDisable(role)
        }
        enableOutput('windowed', role)
        emitOutputEnable('windowed', role)
    }

    function togglePopOut(role: OutputRole): void {
        if (outputs[role]?.displayId === 'windowed') {
            disableOutput(role)
            emitOutputDisable(role)
        } else {
            handlePopOut(role)
        }
    }

    function isWindowed(role: OutputRole): boolean {
        return outputs[role]?.displayId === 'windowed'
    }

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
        </div>
    )
}
