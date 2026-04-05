/**
 * DeviceSelector — audio output device picker.
 * Populates from navigator.mediaDevices.enumerateDevices().
 * Calls AudioDeviceManager.setOutputDevice on change.
 */
import React, { useEffect, useRef, useState } from 'react'
import { AudioDeviceManager } from '../../../systems/audio/audio-device-manager'
import { useSettingsStore } from '../../stores/settings-store'

export function DeviceSelector(): React.JSX.Element {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const deviceId = useSettingsStore((s) => s.audioOutputDeviceId)
    const setDeviceId = useSettingsStore((s) => s.setAudioOutputDeviceId)
    const cancelRef = useRef(false)

    async function loadDevices(): Promise<void> {
        cancelRef.current = false
        setLoading(true)
        setError(null)
        try {
            const found = await AudioDeviceManager.enumerateOutputDevices()
            if (!cancelRef.current) setDevices(found)
        } catch {
            if (!cancelRef.current) setError('Could not enumerate audio devices')
        } finally {
            if (!cancelRef.current) setLoading(false)
        }
    }

    useEffect(() => {
        void loadDevices()
        return () => { cancelRef.current = true }
    }, [])

    async function handleChange(e: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
        const id = e.target.value
        setDeviceId(id)
        await AudioDeviceManager.setOutputDevice(id)
    }

    function handleRefresh(): void {
        void loadDevices()
    }

    return (
        <div className="settings-device-selector">
            <select
                className="form-select settings-device-selector__select"
                value={deviceId}
                onChange={(e) => { void handleChange(e) }}
                disabled={loading}
                aria-label="Audio output device"
            >
                <option value="">System Default</option>
                {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Audio Output ${d.deviceId.slice(0, 8)}`}
                    </option>
                ))}
            </select>
            <button
                className="btn btn-secondary settings-device-selector__refresh"
                onClick={handleRefresh}
                disabled={loading}
                type="button"
            >
                {loading ? 'Detecting…' : 'Refresh'}
            </button>
            {error && <span className="text-error settings-device-selector__error">{error}</span>}
        </div>
    )
}
