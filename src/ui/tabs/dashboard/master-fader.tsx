/**
 * MasterFader — Clickable volume display with popout vertical fader.
 * Sprint 18e: Replaced horizontal strip with compact popout pattern.
 *
 * Shows "Master XX%" text. Click toggles a short vertical fader popout.
 * Clicking anywhere else dismisses the popout.
 */
import React, { useCallback } from 'react'
import { useMoodStore } from '../../stores/mood-store'
import { useOutputStore } from '../../stores/output-store'
import { useClickOutside } from '../../hooks/use-click-outside'
import { VerticalFader } from '../../components/vertical-fader'

export function MasterFader(): React.JSX.Element | null {
    const masterVolume = useMoodStore((s) => s.masterVolume)
    const setMasterVolume = useMoodStore((s) => s.setMasterVolume)
    const hasBGOutput = useOutputStore((s) => s.outputs.BG !== null)
    const { open, setOpen, ref: wrapperRef } = useClickOutside()

    const handleChange = useCallback((vol: number) => setMasterVolume(vol), [setMasterVolume])

    if (!hasBGOutput) return null

    const pct = Math.round(masterVolume * 100)
    const icon = masterVolume <= 0 ? '\u{1F507}' : '\u{1F50A}'

    return (
        <div className="master-fader-popout" ref={wrapperRef}>
            <button
                className="master-fader-popout__trigger"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-label={`Master volume ${pct}%`}
            >
                <span className="master-fader-popout__icon" aria-hidden="true">{icon}</span>
                <span className="master-fader-popout__text">Master {pct}%</span>
            </button>
            {open && (
                <div className="master-fader-popout__dropdown">
                    <VerticalFader
                        value={masterVolume}
                        onChange={handleChange}
                        size="short"
                    />
                </div>
            )}
        </div>
    )
}
