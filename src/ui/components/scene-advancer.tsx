/**
 * Scene Advancer — Sprint 8f.
 * Branching outcome UI shown in expanded scene card when scene is active.
 * Per spec Section 6.6:
 *   0 branches → no advancer
 *   1 branch   → single "Next: [label]" button
 *   2+ branches → labeled choice buttons
 *
 * When the DM picks an outcome, the transitionNote is shown as a brief
 * toast/notification before the target scene loads.
 */
import React, { useState } from 'react'
import type { SceneBranch, Scene } from '@core/types'

interface SceneAdvancerProps {
    branches: SceneBranch[]
    allScenes: Scene[]
    onAdvance: (targetSceneId: string, transitionNote: string) => void
}

/**
 * Renders branch choice buttons for the active scene.
 * Returns null when there are no branches (manual navigation).
 */
export function SceneAdvancer({ branches, allScenes, onAdvance }: SceneAdvancerProps): React.JSX.Element | null {
    const [advancing, setAdvancing] = useState(false)

    if (branches.length === 0) return null

    function handleAdvance(branch: SceneBranch): void {
        if (advancing) return
        setAdvancing(true)
        onAdvance(branch.targetSceneId, branch.transitionNote)
        // Reset after delay covering the full toast duration (2000ms) + buffer
        setTimeout(() => setAdvancing(false), 2500)
    }

    if (branches.length === 1) {
        const branch = branches[0]!
        const target = allScenes.find((s) => s.id === branch.targetSceneId)
        return (
            <div className="scene-advancer">
                <button
                    className="btn btn-primary scene-advancer__btn scene-advancer__btn--single"
                    onClick={() => handleAdvance(branch)}
                    disabled={advancing}
                    aria-label={`Advance to next scene: ${branch.label}`}
                >
                    Next: {branch.label}
                    {target && (
                        <span className="scene-advancer__target">
                            {target.name}
                        </span>
                    )}
                </button>
            </div>
        )
    }

    // 2+ branches: show labeled choice buttons
    return (
        <div className="scene-advancer">
            <div className="scene-advancer__label">Advance Scene</div>
            <div className="scene-advancer__choices">
                {branches.map((branch) => {
                    const target = allScenes.find((s) => s.id === branch.targetSceneId)
                    return (
                        <button
                            key={`${branch.label}-${branch.targetSceneId}`}
                            className="btn btn-secondary scene-advancer__btn"
                            onClick={() => handleAdvance(branch)}
                            disabled={advancing}
                            aria-label={`Choose outcome: ${branch.label}`}
                        >
                            {branch.label}
                            {target && (
                                <span className="scene-advancer__target">
                                    {target.name}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
