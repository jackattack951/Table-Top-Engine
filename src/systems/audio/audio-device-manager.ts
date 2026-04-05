/**
 * AudioDeviceManager singleton — manages audio output device routing.
 *
 * Scope: HTMLVideoElement.setSinkId() only.
 * AudioContext.setSinkId() (Chrome 110+) is out of scope for Sprint 23a —
 * add to backlog once HTMLVideoElement routing is validated.
 */

class AudioDeviceManagerClass {
    private currentDeviceId = ''
    private videoElements: Set<HTMLVideoElement> = new Set()

    /** Device labels only visible after permission grant (browser security requirement). */
    async enumerateOutputDevices(): Promise<MediaDeviceInfo[]> {
        if (!navigator.mediaDevices?.enumerateDevices) return []
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            return devices.filter((d) => d.kind === 'audiooutput')
        } catch (err) {
            console.warn('[AudioDeviceManager] enumerateDevices failed:', err)
            return []
        }
    }

    /** Route all registered HTMLVideoElements to the given device. Pass '' for system default. */
    async setOutputDevice(deviceId: string): Promise<void> {
        this.currentDeviceId = deviceId
        await Promise.all(Array.from(this.videoElements).map((el) => this.applySinkId(el, deviceId)))
    }

    /** Register a video element for device routing. Current device is applied immediately. */
    async registerVideoElement(el: HTMLVideoElement): Promise<void> {
        this.videoElements.add(el)
        await this.applySinkId(el, this.currentDeviceId)
    }

    /** Unregister a video element on unmount. */
    unregisterVideoElement(el: HTMLVideoElement): void {
        this.videoElements.delete(el)
    }

    private async applySinkId(el: HTMLVideoElement, deviceId: string): Promise<void> {
        if (!('setSinkId' in el)) {
            console.warn('[AudioDeviceManager] setSinkId not supported in this browser')
            return
        }
        try {
            await (el as HTMLVideoElement & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId)
        } catch (err) {
            console.warn('[AudioDeviceManager] setSinkId failed:', err)
        }
    }
}

export const AudioDeviceManager = new AudioDeviceManagerClass()
