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
import React, { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores/settings-store'
import { validateSettingsExport } from '../stores/settings-store'
import type { SettingsExport, SettingsState } from '../stores/settings-store'
import { DeviceSelector } from './settings/device-selector'
import { DisplayAssignmentPanel } from './settings/display-assignment-panel'
import { CompanionSettingsPanel } from './settings/companion-settings-panel'
import { ThemeToggle } from './settings/theme-toggle'
import { DensityToggle } from './settings/density-toggle'
import { applyTheme, applyDensity, getSavedTheme, getSavedDensity } from '../lib/appearance'
import { downloadFile } from '../lib/download-file'

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

    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [importError, setImportError] = useState('')

    // Auto-dismiss success message after 3 seconds
    useEffect(() => {
        if (importStatus !== 'success') return
        const timer = setTimeout(() => setImportStatus('idle'), 3000)
        return () => clearTimeout(timer)
    }, [importStatus])

    function handleExport(): void {
        const s = useSettingsStore.getState()
        const settings: SettingsState = {
            audioOutputDeviceId: s.audioOutputDeviceId,
            masterVolumeDefault: s.masterVolumeDefault,
            musicVolumeDefault: s.musicVolumeDefault,
            sfxVolumeDefault: s.sfxVolumeDefault,
            bgVideoVolumeDefault: s.bgVideoVolumeDefault,
            gbVideoVolumeDefault: s.gbVideoVolumeDefault,
            ambienceVolumeDefault: s.ambienceVolumeDefault,
            characterSelectMode: s.characterSelectMode,
            maxPlayers: s.maxPlayers,
            autoApprove: s.autoApprove,
            requireReadyCheck: s.requireReadyCheck,
            sessionCodeLength: s.sessionCodeLength,
        }
        const payload: SettingsExport = {
            version: 1,
            theme: getSavedTheme(),
            density: getSavedDensity(),
            settings,
        }
        downloadFile(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'stage-manager-settings.json')
    }

    function handleImportFile(e: React.ChangeEvent<HTMLInputElement>): void {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            try {
                const parsed: unknown = JSON.parse(reader.result as string)
                const data = validateSettingsExport(parsed)
                if (!data) {
                    setImportError('Invalid settings file — version mismatch or missing fields.')
                    setImportStatus('error')
                    return
                }
                useSettingsStore.setState(data.settings)
                applyTheme(data.theme)
                applyDensity(data.density)
                setImportStatus('success')
                setImportError('')
            } catch {
                setImportError('Could not read file — make sure it is valid JSON.')
                setImportStatus('error')
            }
        }
        reader.readAsText(file)

        // Reset file input so re-importing the same file triggers onChange again
        e.target.value = ''
    }

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
                <DisplayAssignmentPanel />
            </section>

            <section className="settings-section">
                <h2 className="settings-section__title">Companion</h2>
                <CompanionSettingsPanel />
            </section>

            <section className="settings-section">
                <h2 className="settings-section__title">Appearance</h2>
                <div className="settings-row">
                    <span className="settings-row__label">Theme</span>
                    <div className="settings-row__control">
                        <ThemeToggle />
                    </div>
                </div>
                <div className="settings-row">
                    <span className="settings-row__label">Density</span>
                    <div className="settings-row__control">
                        <DensityToggle />
                    </div>
                </div>
            </section>

            <section className="settings-section">
                <h2 className="settings-section__title">Data</h2>
                <p className="settings-section__desc">
                    Export or import all settings as a JSON file.
                </p>
                <div className="settings-row">
                    <span className="settings-row__label">Export</span>
                    <div className="settings-row__control">
                        <button className="btn btn-secondary" onClick={handleExport}>
                            Download settings.json
                        </button>
                    </div>
                </div>
                <div className="settings-row">
                    <span className="settings-row__label">Import</span>
                    <div className="settings-row__control settings-row__control--column">
                        <input
                            type="file"
                            accept=".json"
                            className="settings-data__file-input"
                            onChange={handleImportFile}
                            aria-label="Import settings file"
                        />
                        {importStatus === 'success' && (
                            <span className="settings-data__status settings-data__status--success">
                                Settings imported successfully.
                            </span>
                        )}
                        {importStatus === 'error' && (
                            <span className="settings-data__status settings-data__status--error">
                                {importError}
                            </span>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}
