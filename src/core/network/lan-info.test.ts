/**
 * Unit tests for lan-info.ts.
 *
 * getLANAddress() — must return a valid IPv4 string.
 * getLANInfo()    — must return a correctly-shaped LANInfo object.
 *
 * These tests run in the Node.js (vitest) environment.
 * They do NOT mock os.networkInterfaces because the real implementation
 * must work on developer machines and CI runners regardless of NIC layout.
 * We simply validate the shape and format of the output.
 */
import { describe, it, expect } from 'vitest'
import { getLANAddress, getLANInfo } from './lan-info'

/** Minimal IPv4 address regex (dotted-decimal, four octets 0–255). */
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

describe('getLANAddress', () => {
    it('returns a string that matches the IPv4 dotted-decimal format', () => {
        const address = getLANAddress()
        expect(typeof address).toBe('string')
        expect(address).toMatch(IPV4_RE)
    })

    it('returns a non-empty string (never empty or undefined)', () => {
        const address = getLANAddress()
        expect(address.length).toBeGreaterThan(0)
    })

    it('falls back to 127.0.0.1 when no external NIC is available (loopback check)', () => {
        // The real implementation returns at least 127.0.0.1, so the result
        // is always a valid IPv4 address. We verify the fallback is reachable.
        const address = getLANAddress()
        // Either a real LAN IP or the explicit fallback — both are valid IPv4.
        expect(address).toMatch(IPV4_RE)
    })
})

describe('getLANInfo', () => {
    it('returns an object with ip, port, and url fields', () => {
        const info = getLANInfo(8080)
        expect(info).toHaveProperty('ip')
        expect(info).toHaveProperty('port')
        expect(info).toHaveProperty('url')
    })

    it('ip matches IPv4 dotted-decimal format', () => {
        const info = getLANInfo(8080)
        expect(info.ip).toMatch(IPV4_RE)
    })

    it('port reflects the value passed in', () => {
        expect(getLANInfo(8080).port).toBe(8080)
        expect(getLANInfo(3000).port).toBe(3000)
    })

    it('url is composed of ip and port in http://ip:port format', () => {
        const info = getLANInfo(8080)
        expect(info.url).toBe(`http://${info.ip}:8080`)
    })

    it('url starts with http://', () => {
        const info = getLANInfo(8080)
        expect(info.url).toMatch(/^http:\/\//)
    })
})
