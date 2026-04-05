/**
 * CompanionSettingsPanel — lobby and companion configuration in Settings.
 *
 * Settings here are persisted in settings-store (localStorage) and applied
 * to the session on SESSION_GO_LIVE via emitGoLive().
 */
import React from 'react'
import { useSettingsStore } from '../../stores/settings-store'
import type { CharacterSelectMode } from '@shared/player-types'

const CHAR_SELECT_MODES: { value: CharacterSelectMode; label: string; desc: string }[] = [
    {
        value: 'roster-only',
        label: 'Pre-built only',
        desc: 'Players must pick from your campaign roster',
    },
    {
        value: 'roster-and-manual',
        label: 'Roster + custom',
        desc: 'Players can pick from roster or enter their own',
    },
    {
        value: 'manual-only',
        label: 'Manual entry only',
        desc: 'Players enter their own character stats',
    },
]

export function CompanionSettingsPanel(): React.JSX.Element {
    const {
        characterSelectMode, setCharacterSelectMode,
        maxPlayers, setMaxPlayers,
        autoApprove, setAutoApprove,
        requireReadyCheck, setRequireReadyCheck,
        sessionCodeLength, setSessionCodeLength,
    } = useSettingsStore()

    return (
        <div className="companion-settings">
            <div className="settings-row settings-row--top">
                <span className="settings-row__label">Character Select</span>
                <div className="settings-row__control settings-row__control--column">
                    {CHAR_SELECT_MODES.map((m) => (
                        <label key={m.value} className="companion-settings__mode-option">
                            <input
                                type="radio"
                                name="char-select-mode"
                                value={m.value}
                                checked={characterSelectMode === m.value}
                                onChange={() => setCharacterSelectMode(m.value)}
                            />
                            <span className="companion-settings__mode-label">{m.label}</span>
                            <span className="companion-settings__mode-desc">{m.desc}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="settings-row">
                <span className="settings-row__label">Max Players</span>
                <div className="settings-row__control">
                    <input
                        type="number"
                        className="form-input companion-settings__num"
                        min={1}
                        max={8}
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(Number(e.target.value))}
                        aria-label="Maximum players"
                    />
                </div>
            </div>

            <div className="settings-row">
                <span className="settings-row__label">Join Approval</span>
                <div className="settings-row__control">
                    <label className="companion-settings__toggle">
                        <input
                            type="checkbox"
                            checked={autoApprove}
                            onChange={(e) => setAutoApprove(e.target.checked)}
                        />
                        <span>Auto-approve players (skip lobby review)</span>
                    </label>
                </div>
            </div>

            <div className="settings-row">
                <span className="settings-row__label">Ready Check</span>
                <div className="settings-row__control">
                    <label className="companion-settings__toggle">
                        <input
                            type="checkbox"
                            checked={requireReadyCheck}
                            onChange={(e) => setRequireReadyCheck(e.target.checked)}
                        />
                        <span>Require ready check before going live</span>
                    </label>
                </div>
            </div>

            <div className="settings-row">
                <span className="settings-row__label">Session Code</span>
                <div className="settings-row__control">
                    <input
                        type="number"
                        className="form-input companion-settings__num"
                        min={4}
                        max={8}
                        value={sessionCodeLength}
                        onChange={(e) => setSessionCodeLength(Number(e.target.value))}
                        aria-label="Session code length"
                    />
                    <span className="settings-row__unit">characters</span>
                </div>
            </div>
        </div>
    )
}
