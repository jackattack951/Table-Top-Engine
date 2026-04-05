/**
 * Full-screen overlay shown when the DM sends a roll prompt.
 * Displays the die, label, countdown timer, and a roll button.
 * Submits the result and dismisses itself.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useCompanionStore } from '../stores/companion-store'
import { companionEmit } from '../lib/companion-sync'
import { EVENTS } from '@shared/socket-events'

export function RollPromptOverlay(): JSX.Element | null {
    const prompt = useCompanionStore((s) => s.activeRollPrompt)
    const setRollPrompt = useCompanionStore((s) => s.setRollPrompt)

    const [timeLeft, setTimeLeft] = useState(0)
    const [result, setResult] = useState<number | null>(null)
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync timeLeft when prompt changes
    useEffect(() => {
        if (!prompt) {
            setResult(null)
            return
        }
        const elapsed = Math.floor((Date.now() - prompt.timestamp) / 1000)
        setTimeLeft(Math.max(0, prompt.countdown - elapsed))
        setResult(null)
    }, [prompt])

    // Countdown tick
    useEffect(() => {
        if (!prompt || timeLeft <= 0) return
        const id = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
        return () => clearTimeout(id)
    }, [prompt, timeLeft])

    // Clean up dismiss timer on unmount
    useEffect(() => {
        return () => {
            if (dismissTimer.current) clearTimeout(dismissTimer.current)
        }
    }, [])

    const handleRoll = useCallback(() => {
        if (!prompt || result !== null) return
        const sides = parseInt(prompt.die.replace(/^d/i, ''), 10)
        const rolled = isNaN(sides) ? 1 : Math.floor(Math.random() * sides) + 1
        setResult(rolled)
        companionEmit(EVENTS.ROLL_RESULT_SUBMIT, {
            promptId: prompt.id,
            result: rolled,
        })
        // Auto-dismiss after 2s so the player sees their result
        dismissTimer.current = setTimeout(() => setRollPrompt(null), 2000)
    }, [prompt, result, setRollPrompt])

    if (!prompt) return null

    const expired = timeLeft <= 0 && result === null
    const dieSides = prompt.die.toUpperCase()

    return (
        <div className="roll-prompt-overlay">
            <div className="roll-prompt-overlay__card">
                <p className="roll-prompt-overlay__label">{prompt.label}</p>

                <div className="roll-prompt-overlay__die">{dieSides}</div>

                {result !== null ? (
                    <div className="roll-prompt-overlay__result">
                        <span className="roll-prompt-overlay__result-value">{result}</span>
                        <span className="roll-prompt-overlay__result-label">Submitted!</span>
                    </div>
                ) : (
                    <>
                        {prompt.countdown > 0 && (
                            <div className={`roll-prompt-overlay__timer${timeLeft <= 5 ? ' roll-prompt-overlay__timer--urgent' : ''}`}>
                                {expired ? 'Time\'s up' : `${timeLeft}s`}
                            </div>
                        )}
                        <button
                            className="btn btn-primary roll-prompt-overlay__roll-btn"
                            onClick={handleRoll}
                            disabled={expired}
                        >
                            Roll {dieSides}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
