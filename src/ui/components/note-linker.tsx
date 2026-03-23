/**
 * NoteLinker — scene linking pills + dropdown.
 * Displays linked scenes as pills with unlink, plus a dropdown to add new links.
 * Sprint 8d.
 */
import React from 'react'
import type { Scene } from '@core/types'

interface NoteLinkerProps {
    linkedSceneIds: string[]
    allScenes: Scene[]
    onLink: (sceneId: string) => void
    onUnlink: (sceneId: string) => void
}

export function NoteLinker({
    linkedSceneIds,
    allScenes,
    onLink,
    onUnlink,
}: NoteLinkerProps): React.JSX.Element {
    const linkedScenes = allScenes.filter((s) => linkedSceneIds.includes(s.id))
    const unlinkedScenes = allScenes.filter((s) => !linkedSceneIds.includes(s.id))

    return (
        <div className="note-linker">
            <div className="label-caps">Linked Scenes</div>

            {linkedScenes.length === 0 && (
                <p className="note-linker__empty">No linked scenes.</p>
            )}

            <div className="note-linker__pills">
                {linkedScenes.map((scene) => (
                    <span key={scene.id} className="scene-link-pill">
                        {scene.name}
                        <button
                            className="scene-link-pill__remove"
                            onClick={() => onUnlink(scene.id)}
                            aria-label={`Unlink ${scene.name}`}
                            type="button"
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>

            {unlinkedScenes.length > 0 && (
                <select
                    className="form-select note-linker__select"
                    value=""
                    onChange={(e) => {
                        if (e.target.value) onLink(e.target.value)
                    }}
                    aria-label="Link to scene"
                >
                    <option value="">+ Link to Scene…</option>
                    {unlinkedScenes.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            )}
        </div>
    )
}
