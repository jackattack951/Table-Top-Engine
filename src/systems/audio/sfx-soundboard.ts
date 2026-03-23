/**
 * SFX Soundboard — Web Audio API one-shot and loop trigger system.
 * Architecture Rule 11: Every SFX clip ALWAYS routes through a PannerNode.
 *   Even when spatial values are neutral, the PannerNode is present.
 *   Spatial audio = changing values, not a refactor.
 *
 * Signal chain per clip:
 *   AudioBufferSourceNode → GainNode → PannerNode → AudioContext.destination
 *
 * File loading:
 *   filePath is fetched via Web Fetch API and decoded via AudioContext.decodeAudioData.
 *   Decoded buffers are cached by filePath so repeated triggers never re-fetch.
 *   If filePath is empty or the fetch/decode fails, the clip is silently skipped
 *   with a console warning (no oscillator fallback).
 *
 * Spatial mapping (Section 5.4):
 *   clip.spatial.x (0–1) → PannerNode.positionX (-1 to +1, left→right)
 *   clip.spatial.y (0–1) → PannerNode.positionZ (-1 to +1, front→rear)
 *   PannerNode.positionY fixed at 0
 *   AudioContext.listener fixed at center (0, 0, 0)
 */
import type { SFXClip } from '@core/types'

export type { SFXClip }

type ActiveClip = {
    source: AudioBufferSourceNode
    gain: GainNode
    panner: PannerNode
    clipId: string
}

export class SFXSoundboard {
    private ctx: AudioContext | null = null
    private masterGain: GainNode | null = null
    private active: Map<string, ActiveClip> = new Map()
    private clipCache: Map<string, AudioBuffer> = new Map()

    init(): void {
        this.ctx = new AudioContext()

        // Master gain node for user volume control
        this.masterGain = this.ctx.createGain()
        this.masterGain.connect(this.ctx.destination)

        // Fix listener at room center (Rule 11)
        const l = this.ctx.listener
        if (l.positionX !== undefined) {
            l.positionX.value = 0
            l.positionY.value = 0
            l.positionZ.value = 0
        }
    }

    /**
     * Load an AudioBuffer for the given file path.
     * Returns cached buffer on repeat calls. Returns null on any failure.
     */
    private async loadBuffer(filePath: string): Promise<AudioBuffer | null> {
        if (!this.ctx) return null
        const cached = this.clipCache.get(filePath)
        if (cached) return cached
        try {
            const response = await fetch(filePath)
            const arrayBuffer = await response.arrayBuffer()
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer)
            this.clipCache.set(filePath, audioBuffer)
            return audioBuffer
        } catch (err) {
            console.warn('[sfx-soundboard] failed to load clip:', filePath, err)
            return null
        }
    }

    async trigger(clip: SFXClip): Promise<void> {
        if (!this.ctx) {
            console.warn('[sfx-soundboard] not initialized — call init() first')
            return
        }

        // Silent fallback: no filePath means nothing to play
        if (!clip.filePath) {
            console.warn('[sfx-soundboard] no filePath for clip:', clip.id)
            return
        }

        // Resume context if suspended by browser autoplay policy
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume()
        }

        const buffer = await this.loadBuffer(clip.filePath)
        if (!buffer) {
            return // loadBuffer already logged the warning
        }

        // Restart semantics: stop existing clip with same id
        if (this.active.has(clip.id)) this.stop(clip.id)

        const ctx = this.ctx

        // GainNode
        const gain = ctx.createGain()
        gain.gain.value = clip.volume

        // PannerNode — Rule 11: always present
        const panner = ctx.createPanner()
        panner.panningModel = 'HRTF'
        panner.distanceModel = 'linear'

        const px = clip.spatial ? (clip.spatial.x * 2 - 1) : 0
        const pz = clip.spatial ? (clip.spatial.y * 2 - 1) : 0

        panner.positionX.value = px
        panner.positionY.value = 0
        panner.positionZ.value = pz

        // AudioBufferSourceNode
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = clip.loop

        // Connect chain — route through masterGain for user volume control
        source.connect(gain)
        gain.connect(panner)
        panner.connect(this.masterGain ?? ctx.destination)
        source.start()

        if (clip.loop) {
            // Track in active map — stopped by explicit stop() call
            this.active.set(clip.id, { source, gain, panner, clipId: clip.id })
        } else {
            // One-shot: fade out then stop
            gain.gain.setValueAtTime(clip.volume, ctx.currentTime)
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
            setTimeout(() => {
                try { source.stop() } catch { /* already stopped */ }
                gain.disconnect()
                panner.disconnect()
            }, 520) // 520 ms > 400 ms fade + clock-start buffer
        }
    }

    stop(clipId: string): void {
        const entry = this.active.get(clipId)
        if (!entry || !this.ctx) return

        const now = this.ctx.currentTime
        entry.gain.gain.setValueAtTime(entry.gain.gain.value, now)
        entry.gain.gain.linearRampToValueAtTime(0, now + 0.3)
        setTimeout(() => {
            try { entry.source.stop() } catch { /* already stopped */ }
            entry.gain.disconnect()
            entry.panner.disconnect()
        }, 380)

        this.active.delete(clipId)
    }

    /** Set user master volume (0–1) for all SFX output. */
    setMasterVolume(vol: number): void {
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05)
        }
    }

    stopAll(): void {
        for (const id of [...this.active.keys()]) this.stop(id)
    }

    destroy(): void {
        this.stopAll()
        this.ctx?.close()
        this.ctx = null
        this.clipCache.clear()
    }
}
