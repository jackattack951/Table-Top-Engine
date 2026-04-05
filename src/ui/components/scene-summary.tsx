/**
 * SceneSummary — read-only at-a-glance view of a scene's configuration.
 * Rendered at the top of an expanded SceneCard.
 * Includes Markdown export (clipboard copy + .md download).
 */
import React, { useCallback } from 'react'
import { COLOR_GRADE_PRESETS, COLOR_GRADE_DEFAULT } from '../tabs/av/color-grade-presets'
import type { Scene } from '@core/types'
import type { SceneSummaryResponse } from '../hooks/use-scene-summary'

// ── Markdown builder (pure — testable without DOM) ────────────────────────────

/**
 * Builds a Markdown summary string from aggregated scene data.
 * Used by both the copy and download buttons.
 */
export function buildSceneSummaryMarkdown(
    summary: SceneSummaryResponse,
    allScenes: Scene[],
): string {
    const { scene, npcs, notes, items, bgAsset, gbAsset } = summary
    const lines: string[] = [`# Scene: ${scene.name}`, '']

    // Media
    lines.push('## Media')
    lines.push(`- **Background:** ${bgAsset ? bgAsset.fileName : 'None assigned'}`)
    lines.push(`- **Gameboard:** ${gbAsset ? gbAsset.fileName : 'None assigned'}`)
    lines.push('')

    // Atmosphere
    const particleLabel = scene.particles.type === 'none'
        ? 'Off'
        : `${capitalize(scene.particles.type)} (${Math.round(scene.particles.intensity * 100)}%)`

    const bgPreset = matchColorGradePreset(scene.colorGrade)
    const gbPreset = matchColorGradePreset(scene.gbColorGrade)

    lines.push('## Atmosphere')
    lines.push(`- **Particles:** ${particleLabel}`)
    lines.push(`- **Mood:** ${Math.round(scene.audioMood * 100)}%`)
    lines.push(`- **BG Color Grade:** ${bgPreset}`)
    lines.push(`- **GB Color Grade:** ${gbPreset}`)
    lines.push(`- **Fog:** ${scene.fogEnabled ? 'Enabled' : 'Disabled'}`)
    lines.push('')

    // NPCs
    lines.push(`## NPCs (${npcs.length})`)
    for (const npc of npcs) lines.push(`- ${npc.name}`)
    if (npcs.length === 0) lines.push('- None')
    lines.push('')

    // Items
    lines.push(`## Items (${items.length})`)
    for (const item of items) lines.push(`- ${item.name} [${item.status}]`)
    if (items.length === 0) lines.push('- None')
    lines.push('')

    // Notes
    lines.push(`## Notes (${notes.length})`)
    for (const note of notes) lines.push(`- [${note.type}] ${note.title}`)
    if (notes.length === 0) lines.push('- None')
    lines.push('')

    // Branches
    lines.push(`## Branches (${scene.branches.length})`)
    for (const branch of scene.branches) {
        const target = allScenes.find((s) => s.id === branch.targetSceneId)
        lines.push(`- ${branch.label} → ${target ? target.name : '(unknown scene)'}`)
    }
    if (scene.branches.length === 0) lines.push('- None')

    return lines.join('\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
    return str.length === 0 ? str : str[0]!.toUpperCase() + str.slice(1)
}

type ColorGradeValues = { brightness: number; contrast: number; saturation: number; temperature: number; tint: string }

function colorGradesMatch(a: ColorGradeValues, b: ColorGradeValues): boolean {
    return (
        Math.abs(a.brightness - b.brightness) < 0.001 &&
        Math.abs(a.contrast - b.contrast) < 0.001 &&
        Math.abs(a.saturation - b.saturation) < 0.001 &&
        Math.abs(a.temperature - b.temperature) < 0.001 &&
        a.tint === b.tint
    )
}

function matchColorGradePreset(grade: ColorGradeValues | undefined): string {
    if (!grade) return 'Default'
    for (const preset of COLOR_GRADE_PRESETS) {
        if (colorGradesMatch(preset.values, grade)) return preset.label
    }
    if (colorGradesMatch(COLOR_GRADE_DEFAULT, grade)) return 'Default'
    return 'Custom'
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SceneSummaryProps {
    summary: SceneSummaryResponse
    allScenes: Scene[]
}

export function SceneSummary({ summary, allScenes }: SceneSummaryProps): React.JSX.Element {
    const { scene, npcs, notes, items, bgAsset, gbAsset } = summary

    const particleLabel = scene.particles.type === 'none'
        ? 'Off'
        : `${capitalize(scene.particles.type)} ${Math.round(scene.particles.intensity * 100)}%`

    const bgPreset = matchColorGradePreset(scene.colorGrade)
    const gbPreset = matchColorGradePreset(scene.gbColorGrade)

    const handleCopy = useCallback(() => {
        const md = buildSceneSummaryMarkdown(summary, allScenes)
        void navigator.clipboard.writeText(md)
    }, [summary, allScenes])

    const handleDownload = useCallback(() => {
        const md = buildSceneSummaryMarkdown(summary, allScenes)
        const blob = new Blob([md], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${scene.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-summary.md`
        a.click()
        URL.revokeObjectURL(url)
    }, [summary, allScenes])

    return (
        <div className="scene-summary">
            {/* Media */}
            <div className="scene-summary__section">
                <span className="scene-summary__label">Media</span>
                <span className="scene-summary__value">
                    BG: {bgAsset ? bgAsset.fileName : 'None'} &nbsp;/&nbsp; GB: {gbAsset ? gbAsset.fileName : 'None'}
                </span>
            </div>

            {/* Atmosphere */}
            <div className="scene-summary__section">
                <span className="scene-summary__label">Atmosphere</span>
                <span className="scene-summary__value">
                    {particleLabel} &middot; Mood {Math.round(scene.audioMood * 100)}%
                    &nbsp;&middot;&nbsp; BG: {bgPreset} &middot; GB: {gbPreset}
                    &nbsp;&middot;&nbsp; Fog: {scene.fogEnabled ? 'On' : 'Off'}
                </span>
            </div>

            {/* NPCs */}
            {npcs.length > 0 && (
                <div className="scene-summary__section">
                    <span className="scene-summary__label">NPCs ({npcs.length})</span>
                    <span className="scene-summary__value">
                        {npcs.map((n) => n.name).join(', ')}
                    </span>
                </div>
            )}

            {/* Items */}
            {items.length > 0 && (
                <div className="scene-summary__section">
                    <span className="scene-summary__label">Items ({items.length})</span>
                    <span className="scene-summary__value">
                        {items.map((item) => (
                            <span key={item.id}>
                                {item.name}
                                <span className="scene-summary__badge">{item.status}</span>
                            </span>
                        ))}
                    </span>
                </div>
            )}

            {/* Notes */}
            {notes.length > 0 && (
                <div className="scene-summary__section">
                    <span className="scene-summary__label">Notes ({notes.length})</span>
                    <span className="scene-summary__value">
                        {notes.map((note) => (
                            <span key={note.id}>
                                <span className="scene-summary__badge">{note.type}</span>
                                {note.title}
                            </span>
                        ))}
                    </span>
                </div>
            )}

            {/* Branches */}
            {scene.branches.length > 0 && (
                <div className="scene-summary__section">
                    <span className="scene-summary__label">Branches ({scene.branches.length})</span>
                    <span className="scene-summary__value">
                        {scene.branches.map((b) => {
                            const target = allScenes.find((s) => s.id === b.targetSceneId)
                            return `${b.label} → ${target ? target.name : '?'}`
                        }).join(', ')}
                    </span>
                </div>
            )}

            {/* Export actions */}
            <div className="scene-summary__actions">
                <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
                    Copy Summary
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleDownload}>
                    Download .md
                </button>
            </div>
        </div>
    )
}
