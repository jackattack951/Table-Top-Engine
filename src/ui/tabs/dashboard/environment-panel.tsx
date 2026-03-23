/**
 * EnvironmentPanel — Environment Presets section extracted from DashboardTab (Sprint 10b).
 *
 * Self-contained: accesses AV and mood stores directly. Persists preset application
 * to the active scene when one is loaded.
 */
import React, { useState } from 'react'
import { useSceneStore } from '../../stores/scene-store'
import { useAVStore } from '../../stores/av-store'
import { useMoodStore } from '../../stores/mood-store'
import { patchScene } from '../../hooks/use-scenes'
import {
    getEnvironments,
    getPresetsForEnvironment,
    type EnvironmentPreset,
} from '@assets/presets/environment-presets'

export function EnvironmentPanel(): React.JSX.Element {
    const { activeScene } = useSceneStore()
    const avStore = useAVStore()
    const moodStore = useMoodStore()

    const ENVIRONMENTS = getEnvironments()
    const [selectedEnvironment, setSelectedEnvironment] = useState(ENVIRONMENTS[0] ?? 'tavern')
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
    const [presetApplied, setPresetApplied] = useState<string | null>(null)

    const variantsForEnv = getPresetsForEnvironment(selectedEnvironment)
    const selectedPreset: EnvironmentPreset | null =
        variantsForEnv.find((p) => p.id === selectedPresetId) ?? variantsForEnv[0] ?? null

    async function handleApplyPreset(): Promise<void> {
        if (!selectedPreset) return
        avStore.setParticles(selectedPreset.particles.type, selectedPreset.particles.intensity)
        avStore.setColorGrade(selectedPreset.colorGrade)
        moodStore.setValue(selectedPreset.audioMood)

        if (activeScene) {
            try {
                await patchScene(activeScene.id, {
                    particles: selectedPreset.particles,
                    colorGrade: selectedPreset.colorGrade,
                    audioMood: selectedPreset.audioMood,
                })
                setPresetApplied(`Applied: ${selectedPreset.label}`)
            } catch (err) {
                console.error('[EnvironmentPanel] preset save error:', err)
                setPresetApplied(`Applied (not saved): ${selectedPreset.label}`)
            }
        } else {
            setPresetApplied(`Applied (no active scene): ${selectedPreset.label}`)
        }

        setTimeout(() => setPresetApplied(null), 2500)
    }

    return (
        <div className="environment-panel">
            <div className="section-label">Environment Presets</div>

            {/* Environment selector */}
            <div className="environment-panel__env-row">
                <select
                    className="form-select"
                    value={selectedEnvironment}
                    onChange={(e) => {
                        setSelectedEnvironment(e.target.value)
                        setSelectedPresetId(null)
                    }}
                    aria-label="Select environment"
                >
                    {ENVIRONMENTS.map((env) => (
                        <option key={env} value={env}>
                            {env.charAt(0).toUpperCase() + env.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Variant button group */}
            <div className="environment-panel__variants">
                {variantsForEnv.map((preset) => {
                    const isActive = selectedPreset?.id === preset.id
                    return (
                        <button
                            key={preset.id}
                            className={`environment-panel__variant-btn${isActive ? ' active' : ''}`}
                            onClick={() => setSelectedPresetId(preset.id)}
                            aria-pressed={isActive}
                        >
                            {preset.variant.replace(/-/g, ' ')}
                        </button>
                    )
                })}
            </div>

            {/* Preset description + apply */}
            {selectedPreset && (
                <div className="environment-panel__preset-detail">
                    <p className="environment-panel__preset-desc">
                        {selectedPreset.description}
                    </p>
                    <div className="environment-panel__preset-tags">
                        {selectedPreset.particles.type !== 'none' && (
                            <span className="environment-panel__tag">
                                {selectedPreset.particles.type} {Math.round(selectedPreset.particles.intensity * 100)}%
                            </span>
                        )}
                        <span className="environment-panel__tag">
                            mood {Math.round(selectedPreset.audioMood * 100)}%
                        </span>
                    </div>
                    <button
                        className="btn btn-primary environment-panel__apply-btn"
                        onClick={() => void handleApplyPreset()}
                    >
                        {presetApplied ? presetApplied : `Apply Preset — ${selectedPreset.label}`}
                    </button>
                </div>
            )}
        </div>
    )
}
