import { networkInterfaces } from 'os'

/**
 * LAN network info used to display the cockpit URL to the DM.
 * No Electron imports — safe to use in any process.
 */
export interface LANInfo {
    ip: string
    port: number
    url: string
}

/**
 * Returns the first non-internal IPv4 address found on the machine.
 * Falls back to '127.0.0.1' if no LAN interface is detected.
 */
export function getLANAddress(): string {
    const nets = networkInterfaces()
    for (const name of Object.keys(nets)) {
        const interfaces = nets[name]
        if (!interfaces) continue
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address
            }
        }
    }
    return '127.0.0.1'
}

/**
 * Returns a fully-formed LANInfo object with the detected IP, the given port,
 * and a convenience `url` string for display or QR code generation.
 *
 * @param port - The port the Express/Socket.io server is listening on
 */
export function getLANInfo(port: number): LANInfo {
    const ip = getLANAddress()
    return { ip, port, url: `http://${ip}:${port}` }
}
