/**
 * CombatOverlay — AV Display component.
 *
 * Renders an initiative tracker in the top-right corner of the AV Display window.
 * Shown to PLAYERS at the table — intentionally hides monster HP and AC; only
 * the name, initials avatar, and initiative score are visible.
 *
 * On each turn change a short 440 Hz sine-wave "ping" is played via the Web Audio
 * API to give a subtle auditory cue that the turn has advanced.
 *
 * This component mounts on a React root that sits in front of the PixiJS canvas
 * (pointer-events: none so it never intercepts mouse/touch on the canvas).
 */
import React, { useEffect, useRef } from 'react'
import type { CombatState, Combatant } from '@core/types'

// ── Turn-change audio ping ────────────────────────────────────────────────────

let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
    if (!sharedAudioContext) {
        sharedAudioContext = new AudioContext()
    }
    return sharedAudioContext
}

/**
 * Plays a brief 440 Hz sine wave for 50 ms — a subtle auditory "next turn" cue.
 * Uses Web Audio API directly. No Tone.js — the mood engine owns Tone.js.
 */
function playTurnPing(): void {
    try {
        const ctx = getAudioContext()
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(440, ctx.currentTime)

        // Quick attack, fast release — just a click
        gainNode.gain.setValueAtTime(0, ctx.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.005)
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)

        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.06)
    } catch {
        // AudioContext may not be available in all environments — fail silently
    }
}

// ── CombatantRow ─────────────────────────────────────────────────────────────

interface CombatantRowProps {
    combatant: Combatant
    isActive: boolean
}

function CombatantRow({ combatant, isActive }: CombatantRowProps): React.JSX.Element {
    const initials = combatant.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || '?'

    return (
        <div className={`combat-overlay__row${isActive ? ' active-turn' : ''}`}>
            <div className="combat-overlay__avatar">{initials}</div>
            <span className="combat-overlay__name">{combatant.name}</span>
            <span className="combat-overlay__init">{combatant.initiative}</span>
        </div>
    )
}

// ── CombatOverlay ────────────────────────────────────────────────────────────

interface CombatOverlayProps {
    state: CombatState | null
}

/**
 * Main overlay component. Renders a vertical list of combatants sorted by
 * sortOrder (which the combat store maintains as initiative-descending).
 *
 * When the activeCombatantId changes, plays a turn-change ping.
 */
export function CombatOverlay({ state }: CombatOverlayProps): React.JSX.Element | null {
    const prevActiveRef = useRef<string | null>(null)

    // Play ping when active turn changes (not on mount)
    useEffect(() => {
        if (!state) return
        const current = state.activeCombatantId
        if (prevActiveRef.current !== null && current !== prevActiveRef.current) {
            playTurnPing()
        }
        prevActiveRef.current = current
    }, [state?.activeCombatantId]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!state || state.combatants.length === 0) return null

    // Sort by sortOrder so display matches the DM's tracker
    const sorted = [...state.combatants].sort((a, b) => a.sortOrder - b.sortOrder)

    return (
        <div className="combat-overlay" aria-live="polite" aria-label="Initiative tracker">
            <div className="combat-overlay__title">Initiative</div>
            {sorted.map((c) => (
                <CombatantRow
                    key={c.id}
                    combatant={c}
                    isActive={c.id === state.activeCombatantId}
                />
            ))}
        </div>
    )
}
