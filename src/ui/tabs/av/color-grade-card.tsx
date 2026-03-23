/**
 * ColorGradeCard — Shared color grade controls used by both BG and GB zones.
 * Sprint 18e: Extracted from duplicated code in bg-settings-zone and gb-settings-zone.
 *
 * Renders preset buttons, vertical bipolar faders, and tint color picker.
 */
import React, { useCallback } from 'react'
import { VerticalFader } from '../../components/vertical-fader'
import { COLOR_GRADE_PRESETS, COLOR_GRADE_DEFAULT, COLOR_GRADE_SLIDERS } from './color-grade-presets'
import type { ColorGrade } from '@core/types'

interface ColorGradeCardProps {
    grade: ColorGrade
    onChange: (update: Partial<ColorGrade>) => void
    ariaPrefix?: string
}

export function ColorGradeCard({ grade, onChange, ariaPrefix = '' }: ColorGradeCardProps): React.JSX.Element {
    const handleSlider = useCallback(
        (key: string, value: number) => onChange({ [key]: value }),
        [onChange],
    )

    return (
        <div className="av-card">
            <div className="av-card__title">
                Color Grade
                <button
                    className="btn btn-ghost btn-sm av-card__reset-btn"
                    onClick={() => onChange(COLOR_GRADE_DEFAULT)}
                >
                    Reset
                </button>
            </div>
            <div className="color-grade">
                <div className="color-grade__presets">
                    {COLOR_GRADE_PRESETS.map(({ label, values }) => (
                        <button
                            key={label}
                            className="btn btn-ghost color-grade__preset-btn"
                            onClick={() => onChange(values)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="color-grade__faders">
                    {COLOR_GRADE_SLIDERS.map(({ key, label, min, max }) => (
                        <VerticalFader
                            key={key}
                            value={grade[key]}
                            onChange={(v) => handleSlider(key, v)}
                            min={min}
                            max={max}
                            step={0.01}
                            label={label}
                            size="short"
                            bipolar
                        />
                    ))}
                </div>
                <div className="color-grade__tint-row">
                    <span className="av-slider-compact__label">Tint</span>
                    <input
                        type="color"
                        className="color-grade__tint-swatch"
                        value={grade.tint}
                        onChange={(e) => onChange({ tint: e.target.value })}
                        aria-label={`${ariaPrefix}Tint color`}
                    />
                </div>
            </div>
        </div>
    )
}
