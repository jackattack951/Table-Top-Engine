import React, { useState, useCallback } from 'react'
import { useFogStore } from '../../stores/fog-store'
import { useSceneStore } from '../../stores/scene-store'
import { useAVStore } from '../../stores/av-store'
import { useAppStore } from '../../stores/app-store'
import { FogControls } from '../dashboard/fog-controls'
import { FogOverlay } from '../dashboard/fog-overlay'
import { MediaPicker } from '../../components/media-picker'
import { ColorGradeCard } from './color-grade-card'
import { getAssetFileUrl } from '../../hooks/use-assets'
import { patchScene } from '../../hooks/use-scenes'
import { loadScene, emitFogToggle } from '../../lib/sync'
import type { MediaAsset } from '@shared/asset-types'

// Stable no-op — FogControls handles socket emit and REST call internally
function noop(): void {}

/**
 * Game Board column — fog of war, media, color grade.
 */
export function GBSettingsZone(): React.JSX.Element {
    const fogEnabled = useFogStore((s) => s.fogEnabled)
    const setFogEnabled = useFogStore((s) => s.setFogEnabled)
    const activeScene = useSceneStore((s) => s.activeScene)
    const setActiveScene = useSceneStore((s) => s.setActiveScene)
    const gbColorGrade = useAVStore((s) => s.gbColorGrade)
    const setGBColorGrade = useAVStore((s) => s.setGBColorGrade)
    const [pickerOpen, setPickerOpen] = useState(false)

    const handleSelectMedia = useCallback(async (asset: MediaAsset) => {
        if (!activeScene) return
        try {
            const updated = await patchScene(activeScene.id, { gameboardAssetId: asset.id })
            setActiveScene(updated)
            loadScene(activeScene.id)  // Notify AV Display to reload with new media
        } catch (err) {
            console.error('[GBSettingsZone] assign media error:', err)
        }
        setPickerOpen(false)
    }, [activeScene, setActiveScene])

    const handleClearMedia = useCallback(async () => {
        if (!activeScene) return
        try {
            const updated = await patchScene(activeScene.id, { gameboardAssetId: null })
            setActiveScene(updated)
            loadScene(activeScene.id)  // Notify AV Display to clear media
        } catch (err) {
            console.error('[GBSettingsZone] clear media error:', err)
        }
    }, [activeScene, setActiveScene])

    const isPlayMode = useAppStore((s) => s.appMode === 'play')
    const hasMedia = !!activeScene?.gameboardAssetId

    return (
        <>
            {/* Gameboard Media — hidden in Play mode */}
            {!isPlayMode && (
                <div className={`av-card${hasMedia ? ' av-card--active' : ''}`}>
                    <div className="av-card__title">Media</div>
                    {activeScene?.gameboardAssetId ? (
                        <div className="av-media-preview">
                            <img
                                className="av-media-preview__thumb"
                                src={getAssetFileUrl(activeScene.gameboardAssetId)}
                                alt="Gameboard asset"
                            />
                            <div className="av-media-preview__actions">
                                <button className="btn btn-ghost btn-sm" onClick={() => setPickerOpen(true)}>
                                    Change
                                </button>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => void handleClearMedia()}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button className="btn btn-ghost" onClick={() => setPickerOpen(true)} disabled={!activeScene}>
                            Browse Library
                        </button>
                    )}
                    {!activeScene && (
                        <p className="av-card__hint">Load a scene to assign gameboard media</p>
                    )}
                    <MediaPicker
                        open={pickerOpen}
                        onClose={() => setPickerOpen(false)}
                        onSelect={(asset) => void handleSelectMedia(asset)}
                        categoryFilter={['gameboard']}
                        selectedAssetId={activeScene?.gameboardAssetId}
                        title="Select Gameboard"
                    />
                </div>
            )}

            {/* Fog of War */}
            <div className={`av-card${fogEnabled ? ' av-card--active' : ''}`}>
                <div className="av-card__title">
                    Fog of War
                    <label className="av-card__toggle">
                        <input
                            type="checkbox"
                            checked={fogEnabled}
                            onChange={() => {
                                const next = !fogEnabled
                                setFogEnabled(next)
                                if (activeScene) emitFogToggle({ sceneId: activeScene.id, enabled: next })
                            }}
                        />
                        {fogEnabled ? 'On' : 'Off'}
                    </label>
                </div>
                {fogEnabled && activeScene && (
                    <>
                        <div className="gb-settings__fog-canvas">
                            <FogOverlay />
                        </div>
                        <FogControls onReset={noop} />
                    </>
                )}
                {fogEnabled && !activeScene && (
                    <p className="av-card__hint">Load a scene to paint fog</p>
                )}
            </div>

            {/* GB Color Grade */}
            <ColorGradeCard grade={gbColorGrade} onChange={setGBColorGrade} ariaPrefix="GB " />
        </>
    )
}
