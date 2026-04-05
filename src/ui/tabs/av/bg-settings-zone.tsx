import React, { useState, useCallback } from 'react'
import { useAVStore } from '../../stores/av-store'
import { useSceneStore } from '../../stores/scene-store'
import { useAppStore } from '../../stores/app-store'
import { MediaPicker } from '../../components/media-picker'
import { VerticalFader } from '../../components/vertical-fader'
import { ColorGradeCard } from './color-grade-card'
import { getAssetFileUrl } from '../../hooks/use-assets'
import { patchScene } from '../../hooks/use-scenes'
import { loadScene } from '../../lib/sync'
import type { ParticleType } from '@core/types'
import type { MediaAsset } from '@shared/asset-types'

const PARTICLE_OPTIONS: { type: ParticleType; label: string }[] = [
    { type: 'none', label: 'Off' },
    { type: 'rain', label: 'Rain' },
    { type: 'snow', label: 'Snow' },
    { type: 'ash', label: 'Ash' },
    { type: 'embers', label: 'Embers' },
    { type: 'dust', label: 'Dust' },
    { type: 'fog', label: 'Fog' },
]

/**
 * Background column — particles, color grade, media assignment.
 */
export function BGSettingsZone(): React.JSX.Element {
    const { particles, setParticles, colorGrade, setColorGrade } = useAVStore()
    const activeScene = useSceneStore((s) => s.activeScene)
    const setActiveScene = useSceneStore((s) => s.setActiveScene)
    const isPlayMode = useAppStore((s) => s.appMode === 'play')
    const [pickerOpen, setPickerOpen] = useState(false)

    const handleSelectMedia = useCallback(async (asset: MediaAsset) => {
        if (!activeScene) return
        try {
            const updated = await patchScene(activeScene.id, { backgroundAssetId: asset.id })
            setActiveScene(updated)
            loadScene(activeScene.id)  // Notify AV Display to reload with new media
        } catch (err) {
            console.error('[BGSettingsZone] assign media error:', err)
        }
        setPickerOpen(false)
    }, [activeScene, setActiveScene])

    const handleClearMedia = useCallback(async () => {
        if (!activeScene) return
        try {
            const updated = await patchScene(activeScene.id, { backgroundAssetId: null })
            setActiveScene(updated)
            loadScene(activeScene.id)  // Notify AV Display to clear media
        } catch (err) {
            console.error('[BGSettingsZone] clear media error:', err)
        }
    }, [activeScene, setActiveScene])

    const handleParticle = useCallback(
        (type: ParticleType) => setParticles(type, type === 'none' ? 0 : particles.intensity || 0.7),
        [setParticles, particles.intensity]
    )

    const handleIntensityChange = useCallback(
        (val: number) => setParticles(particles.type, val),
        [setParticles, particles.type],
    )

    const hasMedia = !!activeScene?.backgroundAssetId
    const particlesActive = particles.type !== 'none'

    return (
        <>
            {/* Background Media — hidden in Play mode */}
            {!isPlayMode && (
                <div className={`av-card${hasMedia ? ' av-card--active' : ''}`}>
                    <div className="av-card__title">Media</div>
                    {activeScene?.backgroundAssetId ? (
                        <div className="av-media-preview">
                            <img
                                className="av-media-preview__thumb"
                                src={getAssetFileUrl(activeScene.backgroundAssetId)}
                                alt="Background asset"
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
                        <p className="av-card__hint">Load a scene to assign background media</p>
                    )}
                    <MediaPicker
                        open={pickerOpen}
                        onClose={() => setPickerOpen(false)}
                        onSelect={(asset) => void handleSelectMedia(asset)}
                        categoryFilter={['background']}
                        selectedAssetId={activeScene?.backgroundAssetId}
                        title="Select Background"
                    />
                </div>
            )}

            {/* Particles */}
            <div className={`av-card${particlesActive ? ' av-card--active' : ''}`}>
                <div className="av-card__title">Particles</div>
                <div className="particle-btns">
                    {PARTICLE_OPTIONS.map(({ type, label }) => (
                        <button
                            key={type}
                            className={`particle-btn${particles.type === type ? ' active' : ''}`}
                            onClick={() => handleParticle(type)}
                            aria-pressed={particles.type === type}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {particles.type !== 'none' && (
                    <div className="av-card__fader-inline">
                        <VerticalFader
                            value={particles.intensity}
                            onChange={handleIntensityChange}
                            min={0.05}
                            max={1}
                            step={0.05}
                            label="Intensity"
                            size="short"
                            formatValue={(v) => v.toFixed(2)}
                        />
                    </div>
                )}
            </div>

            {/* Color Grade */}
            <ColorGradeCard grade={colorGrade} onChange={setColorGrade} />
        </>
    )
}
