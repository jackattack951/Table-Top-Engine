/**
 * QRCodePanel — displays a scannable QR code and the plain-text URL
 * for connecting to the cockpit from a LAN device (phone, iPad, etc.).
 *
 * Used on the LaunchScreen when networkMode is 'host'.
 */
import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRCodePanelProps {
    /** Full URL to encode in the QR code */
    serverUrl: string
    /** Optional label shown above the QR code (e.g. "Players scan to join") */
    label?: string
}

/**
 * Renders a QR code image and the URL as human-readable text.
 * The QR image is generated client-side via the `qrcode` package.
 */
export function QRCodePanel({ serverUrl, label }: QRCodePanelProps): React.JSX.Element {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!serverUrl) return
        QRCode.toDataURL(serverUrl, {
            width: 128,
            margin: 1,
            color: { dark: '#e8e8e8', light: '#00000000' },
        })
            .then(setQrDataUrl)
            .catch(console.error)
    }, [serverUrl])

    return (
        <div className="qr-panel" role="region" aria-label={label ?? 'LAN connection info'}>
            {label && <span className="qr-panel__title">{label}</span>}
            {qrDataUrl && (
                <img
                    className="qr-panel__code"
                    src={qrDataUrl}
                    alt={`QR code for ${serverUrl}`}
                    width={96}
                    height={96}
                />
            )}
            <div className="qr-panel__url">
                <span className="qr-panel__label">Connect at:</span>
                <code className="qr-panel__address">{serverUrl}</code>
            </div>
        </div>
    )
}
