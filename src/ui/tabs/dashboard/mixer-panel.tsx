/**
 * MixerPanel — 5-channel audio mixer + breathing timer controls.
 * Sprint 17c: Centralized audio mix tab in the dashboard center column.
 * Sprint 18e: Vertical fader overhaul — horizontal → vertical channel strips.
 *
 * Channels: Ambience, Music (mood stems), SFX, BG Video, GB Video.
 * All faders relay through socket to AV Display via store subscriptions.
 * Breathing timer selector allows changing the hold duration (for testing).
 * Architecture: cockpit-only component. Never imports Tone.js (Rule 1).
 */
import React, { useCallback } from 'react'
import { useMoodStore } from '../../stores/mood-store'
import { useOutputStore } from '../../stores/output-store'
import { emitBreathingHold } from '../../lib/sync'
import { VerticalFader } from '../../components/vertical-fader'

const BREATHING_OPTIONS: { label: string; seconds: number }[] = [
    { label: '15s', seconds: 15 },
    { label: '30s', seconds: 30 },
    { label: '1 min', seconds: 60 },
    { label: '2 min', seconds: 120 },
    { label: '5 min', seconds: 300 },
]

type MoodState = ReturnType<typeof useMoodStore.getState>

interface ChannelConfig {
    id: string
    label: string
    select: (s: MoodState) => number
    set: (vol: number) => void
}

const CHANNELS: ChannelConfig[] = [
    { id: 'ambience', label: 'Amb', select: (s) => s.ambienceVolume, set: (v) => useMoodStore.getState().setAmbienceVolume(v) },
    { id: 'music', label: 'Music', select: (s) => s.musicVolume, set: (v) => useMoodStore.getState().setMusicVolume(v) },
    { id: 'sfx', label: 'SFX', select: (s) => s.sfxVolume, set: (v) => useMoodStore.getState().setSfxVolume(v) },
    { id: 'bg-video', label: 'BG Vid', select: (s) => s.bgVideoVolume, set: (v) => useMoodStore.getState().setBgVideoVolume(v) },
    { id: 'gb-video', label: 'GB Vid', select: (s) => s.gbVideoVolume, set: (v) => useMoodStore.getState().setGbVideoVolume(v) },
]

function ChannelFader({ config, disabled }: { config: ChannelConfig; disabled: boolean }): React.JSX.Element {
    const value = useMoodStore(config.select)
    const handleChange = useCallback((vol: number) => config.set(vol), [config])

    return (
        <VerticalFader
            value={value}
            onChange={handleChange}
            label={config.label}
            disabled={disabled}
        />
    )
}

export function MixerPanel(): React.JSX.Element {
    const breathingHoldS = useMoodStore((s) => s.breathingHoldS)
    const setBreathingHoldS = useMoodStore((s) => s.setBreathingHoldS)
    const hasBGOutput = useOutputStore((s) => s.outputs.BG !== null)

    function handleBreathingChange(seconds: number) {
        if (seconds === breathingHoldS) return
        setBreathingHoldS(seconds)
        emitBreathingHold(seconds)
    }

    return (
        <div className="mixer-panel">
            {/* Channel faders — vertical strip */}
            <div className="mixer-panel__section">
                <div className="mixer-panel__label">Channels</div>
                <div className="mixer-panel__fader-row">
                    {CHANNELS.map((ch) => (
                        <ChannelFader
                            key={ch.id}
                            config={ch}
                            disabled={!hasBGOutput}
                        />
                    ))}
                </div>
            </div>

            {/* Breathing timer */}
            <div className="mixer-panel__section">
                <div className="mixer-panel__label">Breathing Cycle</div>
                <p className="mixer-panel__hint">
                    Hold duration before ambience/music swap
                </p>
                <div className="mixer-panel__breathing-grid">
                    {BREATHING_OPTIONS.map((opt) => (
                        <button
                            key={opt.seconds}
                            className={`mixer-panel__breathing-btn${breathingHoldS === opt.seconds ? ' active' : ''}`}
                            onClick={() => handleBreathingChange(opt.seconds)}
                            disabled={!hasBGOutput}
                            aria-pressed={breathingHoldS === opt.seconds}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {!hasBGOutput && (
                <p className="mixer-panel__disabled-hint">
                    Open a Background display to enable audio controls
                </p>
            )}
        </div>
    )
}
