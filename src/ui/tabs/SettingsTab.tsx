/**
 * SettingsTab — global application settings page.
 *
 * Sections:
 *   Audio       — output device selection
 *   Volumes     — default volume levels applied on session start
 *   Display     — display assignment (Phase 23b)
 *   Companion   — lobby config, character select mode (Phase 23b)
 *   Appearance  — theme + density toggles (Phase 23c)
 *   Data        — export / import preferences (Phase 23c)
 */
import React from 'react'
import { useSettingsStore } from '../stores/settings-store'
import { DeviceSelector } from './settings/device-selector'

// ── Volume row ───────────────────────────────────────────────────────────────

interface VolumeRowProps {
    label: string
    value: number
    onChange: (v: number) => void
}

function VolumeRow({ label, value, onChange }: VolumeRowProps): React.JSX.Element {
    return (
        <div className="settings-row">
            <span className="settings-row__label">{label}</span>
            <div className="settings-row__control">
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="settings-slider"
                    aria-label={label}
                />
                <span className="settings-row__value">{Math.round(value * 100)}%</span>
            </div>
        </div>
    )
}

// ── SettingsTab ───────────────────────────────────────────────────────────────

export function SettingsTab(): React.JSX.Element {
    const {
        masterVolumeDefault, setMasterVolumeDefault,
        musicVolumeDefault, setMusicVolumeDefault,
        sfxVolumeDefault, setSfxVolumeDefault,
        bgVideoVolumeDefault, setBgVideoVolumeDefault,
        gbVideoVolumeDefault, setGbVideoVolumeDefault,
        ambienceVolumeDefault, setAmbienceVolumeDefault,
    } = useSettingsStore()

    return (
        <div className="settings-tab">
            <section className="settings-section">
                <h2 className="settings-section__title">Audio</h2>
                <div className="settings-row">
                    <span className="settings-row__label">Output Device</span>
                    <div className="settings-row__control">
                        <DeviceSelector />
                    </div>
                </div>
            </section>

            <section className="settings-section">
                <h2 className="settings-section__title">Volumes</h2>
                <p className="settings-section__desc">
                    Default levels applied when a new session starts.
                </p>
                <VolumeRow label="Master" value={masterVolumeDefault} onChange={setMasterVolumeDefault} />
                <VolumeRow label="Music" value={musicVolumeDefault} onChange={setMusicVolumeDefault} />
                <VolumeRow label="SFX" value={sfxVolumeDefault} onChange={setSfxVolumeDefault} />
                <VolumeRow label="BG Video" value={bgVideoVolumeDefault} onChange={setBgVideoVolumeDefault} />
                <VolumeRow label="GB Video" value={gbVideoVolumeDefault} onChange={setGbVideoVolumeDefault} />
                <VolumeRow label="Ambience" value={ambienceVolumeDefault} onChange={setAmbienceVolumeDefault} />
            </section>

            <section className="settings-section">
                <h2 className="settings-section__title">Display</h2>
                <p className="settings-section__desc settings-section__desc--muted">
                    Display assignment coming in Phase 23b.
                </p>
            </section>

            <section className="settings-section">
                <h2 className="settings-section__title">Companion</h2>
                <p className="settings-section__desc settings-section__desc--muted">
                    Lobby configuration coming in Phase 23b.
                </p>
            </section>

            <section className="settings-section">
                <h2 className="settings-section__title">Appearance</h2>
                <p className="settings-section__desc settings-section__desc--muted">
                    Theme and density toggles coming in Phase 23c.
                </p>
            </section>

            <section className="settings-section">
                <h2 className="settings-section__title">Data</h2>
                <p className="settings-section__desc settings-section__desc--muted">
                    Export / import preferences coming in Phase 23c.
                </p>
            </section>
        </div>
    )
}
