import React, { useEffect, useRef, useState } from 'react'

const LINE_1 = 'Darkened Horizons Interactive presents'
const LINE_2 = 'Stage Manager'
export const CHAR_INTERVAL_MS = 60
export const PAUSE_BETWEEN_LINES_MS = 500
export const HOLD_AFTER_TYPED_MS = 1500

export interface CinematicIntroProps {
    onComplete: () => void
}

/**
 * Sprint 10j: Cinematic intro screen.
 *
 * Plays an Alien-style green monospace typewriter animation before the
 * LaunchScreen. Clicking anywhere or pressing any key skips immediately.
 *
 * Sequence:
 *   1. Type Line 1 character-by-character (60ms/char)
 *   2. Pause 500ms
 *   3. Type Line 2 character-by-character
 *   4. Hold 1.5s
 *   5. Fade to black (500ms CSS transition)
 *   6. Call onComplete()
 */
export function CinematicIntro({ onComplete }: CinematicIntroProps): React.JSX.Element {
    const [line1, setLine1] = useState('')
    const [line2, setLine2] = useState('')
    const [isFading, setIsFading] = useState(false)
    // Which line is currently being typed: 1 or 2. null = typing done, holding.
    const [typingLine, setTypingLine] = useState<1 | 2 | null>(1)
    const skippedRef = useRef(false)
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Skip intro entirely if user has opted out
    useEffect(() => {
        try {
            if (localStorage.getItem('skipIntro') === 'true') {
                skip()
            }
        } catch { /* localStorage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function triggerFadeOut(): void {
        if (skippedRef.current) return
        setIsFading(true)
    }

    function skip(): void {
        if (skippedRef.current) return
        skippedRef.current = true
        onComplete()
    }

    function handleTransitionEnd(): void {
        if (isFading) {
            onComplete()
        }
    }

    // Keyboard skip
    useEffect(() => {
        function handleKeyDown(): void {
            skip()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Cleanup orphaned timers on unmount
    useEffect(() => {
        return () => {
            if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        }
    }, [])

    // Typewriter effect — Line 1
    useEffect(() => {
        if (typingLine !== 1) return

        let charIndex = 0
        const interval = setInterval(() => {
            charIndex++
            setLine1(LINE_1.slice(0, charIndex))
            if (charIndex >= LINE_1.length) {
                clearInterval(interval)
                // Pause before typing line 2
                pauseTimerRef.current = setTimeout(() => {
                    if (!skippedRef.current) setTypingLine(2)
                }, PAUSE_BETWEEN_LINES_MS)
            }
        }, CHAR_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [typingLine])

    // Typewriter effect — Line 2
    useEffect(() => {
        if (typingLine !== 2) return

        let charIndex = 0
        const interval = setInterval(() => {
            charIndex++
            setLine2(LINE_2.slice(0, charIndex))
            if (charIndex >= LINE_2.length) {
                clearInterval(interval)
                setTypingLine(null)
                // Hold then fade
                holdTimerRef.current = setTimeout(() => {
                    if (!skippedRef.current) triggerFadeOut()
                }, HOLD_AFTER_TYPED_MS)
            }
        }, CHAR_INTERVAL_MS)

        return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typingLine])

    // Cursor is visible while typing or during hold, hidden during fade
    const showCursor = !isFading
    // Cursor blinks on whatever line is currently active
    const cursorOnLine2 = typingLine === 2 || typingLine === null

    return (
        <div
            className={`cinematic-intro${isFading ? ' cinematic-intro--fading' : ''}`}
            onClick={skip}
            onTransitionEnd={handleTransitionEnd}
            role="presentation"
            aria-hidden="true"
        >
            <div className="cinematic-intro__text-block">
                <div className="cinematic-intro__line">
                    {line1}
                    {showCursor && !cursorOnLine2 && (
                        <span className="cinematic-intro__cursor" aria-hidden="true" />
                    )}
                </div>
                <div className="cinematic-intro__line">
                    {line2}
                    {showCursor && cursorOnLine2 && (
                        <span className="cinematic-intro__cursor" aria-hidden="true" />
                    )}
                </div>
            </div>
            <p className="cinematic-intro__skip">Click or press any key to skip</p>
        </div>
    )
}
