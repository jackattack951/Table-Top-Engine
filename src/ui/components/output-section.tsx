/**
 * OutputSection — shared output management UI (Sprint 9b).
 *
 * Renders available displays with role dropdowns and a pop-out window button.
 * Used in both DashboardTab (compact) and AVTab (full controls).
 *
 * Rule 13: Outputs are user-enabled, never auto-created.
 * Rule 14: One display, one role — BG or GB, never both simultaneously.
 */
import React, { useEffect, useState } from 'react'
import { useOutputStore } from '../stores/output-store'
import { emitOutputEnable, emitOutputDisable, fetchDisplays } from '../lib/sync'
import type { DisplayInfo, OutputRole } from '../stores/output-store'

interface OutputSectionProps {
    /** When true, shows fullscreen toggle + extra controls */
    expanded?: boolean
}

export function OutputSection({ expanded = false }: OutputSectionProps): React.JSX.Element {
    const { availableDisplays, outputs, setDisplays, enableOutput, disableOutput } = useOutputStore()
    const [loading, setLoading] = useState(false)

    // Fetch displays on mount
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

    // Determine which role is assigned to which display
    function getRoleForDisplay(displayId: number): OutputRole | null {
        if (outputs.BG?.displayId === displayId) return 'BG'
        if (outputs.GB?.displayId === displayId) return 'GB'
        return null
    }

    function handleRoleChange(displayId: number, newRole: string): void {
        const currentRole = getRoleForDisplay(displayId)

        if (newRole === 'disabled') {
            // Disable whatever role was on this display
            if (currentRole) {
                disableOutput(currentRole)
                emitOutputDisable(currentRole)
            }
            return
        }

        const role = newRole as OutputRole

        // If this role is already on a different display, disable it first
        if (outputs[role] && outputs[role]!.displayId !== displayId) {
            disableOutput(role)
            emitOutputDisable(role)
        }

        // If this display had a different role, disable that
        if (currentRole && currentRole !== role) {
            disableOutput(currentRole)
            emitOutputDisable(currentRole)
        }

        enableOutput(displayId, role)
        emitOutputEnable(displayId, role)
    }

    function handlePopOut(role: OutputRole): void {
        // Disable any existing output for this role
        if (outputs[role]) {
            disableOutput(role)
            emitOutputDisable(role)
        }
        enableOutput('windowed', role)
        emitOutputEnable('windowed', role)
    }

    // Filter out the primary/internal display (cockpit is likely there)
    const externalDisplays = availableDisplays.filter((d) => !d.internal)
    const hasExternals = externalDisplays.length > 0

    return (
        <div className="output-section">
            <div className="output-section__label">Outputs</div>

            {loading && (
                <p className="output-section__status">Detecting displays…</p>
            )}

            {!loading && hasExternals && (
                <div className="output-section__grid">
                    {externalDisplays.map((display) => {
                        const currentRole = getRoleForDisplay(display.id)
                        return (
                            <div key={display.id} className="output-card">
                                <div className="output-card__info">
                                    <span className="output-card__name">{display.label}</span>
                                    <span className="output-card__res">
                                        {display.width}×{display.height}
                                    </span>
                                </div>
                                <select
                                    className="form-select output-card__role"
                                    value={currentRole ?? 'disabled'}
                                    onChange={(e) => handleRoleChange(display.id, e.target.value)}
                                    aria-label={`Role for ${display.label}`}
                                >
                                    <option value="disabled">Disabled</option>
                                    <option value="BG">Background</option>
                                    <option value="GB">Game Board</option>
                                </select>
                            </div>
                        )
                    })}
                </div>
            )}

            {!loading && !hasExternals && (
                <p className="output-section__status">
                    No external displays detected
                </p>
            )}

            {/* Pop-out window buttons */}
            <div className="output-section__popouts">
                <span className="output-section__popout-label">Pop-out window:</span>
                <button
                    className={`btn btn-ghost output-section__popout-btn${outputs.BG?.displayId === 'windowed' ? ' active' : ''}`}
                    onClick={() => {
                        if (outputs.BG?.displayId === 'windowed') { disableOutput('BG'); emitOutputDisable('BG') }
                        else handlePopOut('BG')
                    }}
                >
                    {outputs.BG?.displayId === 'windowed' ? 'Close BG' : 'BG'}
                </button>
                <button
                    className={`btn btn-ghost output-section__popout-btn${outputs.GB?.displayId === 'windowed' ? ' active' : ''}`}
                    onClick={() => {
                        if (outputs.GB?.displayId === 'windowed') { disableOutput('GB'); emitOutputDisable('GB') }
                        else handlePopOut('GB')
                    }}
                >
                    {outputs.GB?.displayId === 'windowed' ? 'Close GB' : 'GB'}
                </button>
            </div>

            {/* Active outputs summary */}
            {expanded && (outputs.BG || outputs.GB) && (
                <div className="output-section__active">
                    {outputs.BG && (
                        <div className="output-section__active-item">
                            <span>BG: {outputs.BG.displayId === 'windowed' ? 'Pop-out' : `Display ${outputs.BG.displayId}`}</span>
                            <button
                                className="btn btn-ghost output-section__disconnect"
                                onClick={() => { disableOutput('BG'); emitOutputDisable('BG') }}
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                    {outputs.GB && (
                        <div className="output-section__active-item">
                            <span>GB: {outputs.GB.displayId === 'windowed' ? 'Pop-out' : `Display ${outputs.GB.displayId}`}</span>
                            <button
                                className="btn btn-ghost output-section__disconnect"
                                onClick={() => { disableOutput('GB'); emitOutputDisable('GB') }}
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
