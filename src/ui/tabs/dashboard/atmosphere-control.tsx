/**
 * AtmosphereControl — Ambient audio control panel for the Dashboard center column.
 * Sprint 17c.
 *
 * Two-axis control: Environment (where) × Mood (energy).
 * Environment buttons load a stem set on the AV Display.
 * Mood buttons set the crossfade position (calm/tense/dramatic).
 * Status bar shows live audio state and whether AV output exists.
 * Volume controls live in MixerPanel (MIX tab).
 *
 * Architecture: cockpit-only component. Never imports Tone.js (Rule 1).
 * Uses useMoodStore for state + emitEnvironmentChange for AV relay.
 */
import React from 'react'
import { useMoodStore } from '../../stores/mood-store'
import { useOutputStore } from '../../stores/output-store'
import { emitEnvironmentChange } from '../../lib/sync'
import { ENVIRONMENT_AUDIO_CONFIGS, getEnvironmentAudioConfig } from '@systems/audio/audio-config'
import { getMoodZone, type MoodZone } from '@systems/audio/mood-engine'

type MoodZoneButton = {
    id: 'calm' | 'tense' | 'dramatic'
    label: string
    value: number  // mood slider target
}

const MOOD_ZONES: MoodZoneButton[] = [
    { id: 'calm', label: 'Calm', value: 0.15 },
    { id: 'tense', label: 'Tense', value: 0.5 },
    { id: 'dramatic', label: 'Dramatic', value: 0.85 },
]

export function AtmosphereControl(): React.JSX.Element {
    const moodValue = useMoodStore((s) => s.value)
    const environmentId = useMoodStore((s) => s.environmentId)
    const setValue = useMoodStore((s) => s.setValue)
    const setEnvironmentId = useMoodStore((s) => s.setEnvironmentId)

    const hasBGOutput = useOutputStore((s) => s.outputs.BG !== null)

    const activeZone = getMoodZone(moodValue)
    const isLive = hasBGOutput && !!environmentId
    const envLabel = environmentId
        ? (getEnvironmentAudioConfig(environmentId)?.label ?? environmentId)
        : null

    function handleEnvironmentSelect(envId: string) {
        setEnvironmentId(envId)
        emitEnvironmentChange(envId)
    }

    function handleMoodSelect(zone: MoodZoneButton) {
        setValue(zone.value)
    }

    return (
        <div className="atmo-control">
            {/* Audio status bar */}
            <AudioStatusBar
                hasBGOutput={hasBGOutput}
                environmentLabel={envLabel}
                activeZone={activeZone}
            />

            {/* Environment selector */}
            <div className="atmo-control__section">
                <div className="atmo-control__label">Environment</div>
                <div className="atmo-control__env-grid">
                    {ENVIRONMENT_AUDIO_CONFIGS.map((env) => {
                        const isActive = environmentId === env.id
                        return (
                            <button
                                key={env.id}
                                className={`atmo-control__env-btn${isActive ? ' active' : ''}`}
                                onClick={() => handleEnvironmentSelect(env.id)}
                                aria-pressed={isActive}
                                aria-label={`${env.label} environment`}
                            >
                                <span className="atmo-control__env-icon">
                                    {getEnvIcon(env.id)}
                                </span>
                                <span className="atmo-control__env-name">{env.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Mood zone selector */}
            <div className="atmo-control__section">
                <div className="atmo-control__label">Mood</div>
                <div className="atmo-control__mood-row">
                    {MOOD_ZONES.map((zone) => {
                        const isActive = activeZone === zone.id
                        return (
                            <button
                                key={zone.id}
                                className={`atmo-control__mood-btn atmo-control__mood-btn--${zone.id}${isActive ? ' active' : ''}${isActive && isLive ? ' live' : ''}`}
                                onClick={() => handleMoodSelect(zone)}
                                aria-pressed={isActive}
                                disabled={!environmentId}
                            >
                                {zone.label}
                            </button>
                        )
                    })}
                </div>
                {!environmentId && (
                    <p className="atmo-control__hint">Select an environment to enable mood controls</p>
                )}
            </div>

        </div>
    )
}

/** Compact status bar showing audio pipeline state. */
function AudioStatusBar({ hasBGOutput, environmentLabel, activeZone }: {
    hasBGOutput: boolean
    environmentLabel: string | null
    activeZone: MoodZone
}): React.JSX.Element {
    if (!hasBGOutput) {
        return (
            <div className="atmo-status atmo-status--warning">
                <span className="atmo-status__dot atmo-status__dot--off" />
                <span className="atmo-status__text">No AV Output</span>
                <span className="atmo-status__sub">Open a Background display to enable audio</span>
            </div>
        )
    }

    if (!environmentLabel) {
        return (
            <div className="atmo-status atmo-status--idle">
                <span className="atmo-status__dot atmo-status__dot--idle" />
                <span className="atmo-status__text">Ready</span>
                <span className="atmo-status__sub">Select an environment to start</span>
            </div>
        )
    }

    return (
        <div className={`atmo-status atmo-status--live atmo-status--${activeZone}`}>
            <span className="atmo-status__dot atmo-status__dot--live" />
            <span className="atmo-status__text">
                {environmentLabel}
            </span>
            <span className="atmo-status__zone-badge">{activeZone}</span>
        </div>
    )
}

/** Unicode icon per environment. */
function getEnvIcon(envId: string): string {
    switch (envId) {
        case 'forest': return '\u{1F332}'
        case 'cave': return '\u{26F0}'
        case 'tavern': return '\u{1F37A}'
        case 'night': return '\u{1F319}'
        case 'ocean': return '\u{1F30A}'
        default: return '\u{1F3B5}'
    }
}
