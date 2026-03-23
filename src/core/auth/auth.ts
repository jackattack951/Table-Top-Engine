/**
 * License / auth module — Electron main process only.
 *
 * Uses Electron safeStorage for encrypted local token persistence.
 *
 * IMPORTANT: Never import this file in src/ui/, src/api/, or src/systems/av/.
 *
 * Critical rule (Project.md §9.3):
 *   The app NEVER interrupts a live session for license reasons.
 *   checkLicense() always returns a usable state; it never throws or blocks.
 *   Campaign data is never locked behind license state.
 *
 * License states:
 *   'active'      — valid token, within TTL → full access
 *   'grace'       — token expired but offline → full access (temporary grace)
 *   'lapsed'      — online validation confirmed subscription expired → premium AV restricted (Sprint 5)
 *   'unlicensed'  — no token ever set → full access in early builds (paywall Sprint 5)
 */
import path from 'path'
import fs from 'fs'
import { app, safeStorage } from 'electron'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LicenseState = 'active' | 'grace' | 'lapsed' | 'unlicensed'

interface CachedToken {
    token: string
    issuedAt: number       // Unix ms timestamp
    expiresAt: number      // Unix ms timestamp (subscription expiry from server)
    cachedAt: number       // Unix ms timestamp (when we last validated online)
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Token cache TTL: 30 days in milliseconds. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

function getTokenFilePath(): string {
    return path.join(app.getPath('userData'), 'license.enc')
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function readCachedToken(): CachedToken | null {
    const filePath = getTokenFilePath()
    if (!fs.existsSync(filePath)) {
        return null
    }
    try {
        const encrypted = fs.readFileSync(filePath)
        // safeStorage.decryptString expects a Buffer
        const decrypted = safeStorage.decryptString(encrypted)
        return JSON.parse(decrypted) as CachedToken
    } catch (err) {
        console.warn('[auth] failed to read/decrypt cached token:', err)
        return null
    }
}

function writeCachedToken(token: CachedToken): void {
    const filePath = getTokenFilePath()
    try {
        const json = JSON.stringify(token)
        const encrypted = safeStorage.encryptString(json)
        fs.writeFileSync(filePath, encrypted)
    } catch (err) {
        console.warn('[auth] failed to write cached token:', err)
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Reads the cached token and evaluates license state without any network call.
 * This is the primary check — always fast, always safe to call.
 *
 * Per Project.md §9.3: never throws, never blocks.
 */
export function checkLicense(): LicenseState {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            // Encryption unavailable (headless/CI environment) — treat as active for dev
            console.warn('[auth] safeStorage encryption unavailable — defaulting to active')
            return 'active'
        }

        const cached = readCachedToken()

        if (!cached) {
            return 'unlicensed'
        }

        const now = Date.now()
        const cacheAge = now - cached.cachedAt

        // Check if our local cache of the validation is still within TTL
        if (cacheAge > CACHE_TTL_MS) {
            // Cache is stale — we haven't been online in 30 days — grant grace
            return 'grace'
        }

        // Check if the subscription itself has expired (server-reported expiry)
        if (cached.expiresAt > 0 && now > cached.expiresAt) {
            return 'lapsed'
        }

        return 'active'
    } catch (err) {
        // Never fail hard per Project.md §9.3
        console.warn('[auth] checkLicense error (returning grace):', err)
        return 'grace'
    }
}

/**
 * Attempts online license validation. On network failure, returns the current
 * cached state — never fails hard.
 *
 * If LICENSE_SERVER_URL is unset (dev/early builds), returns 'active' immediately.
 */
export async function validateOnline(): Promise<LicenseState> {
    const serverUrl = process.env['LICENSE_SERVER_URL']

    if (!serverUrl) {
        // Dev mode — no license server configured. Treat as active.
        return 'active'
    }

    try {
        const cached = readCachedToken()
        if (!cached) {
            // No token to validate
            return 'unlicensed'
        }

        const response = await fetch(`${serverUrl}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: cached.token }),
            signal: AbortSignal.timeout(5000), // 5 second timeout
        })

        if (!response.ok) {
            // Server says invalid/expired
            const updated: CachedToken = {
                ...cached,
                expiresAt: Date.now() - 1,  // mark as expired
                cachedAt: Date.now(),
            }
            writeCachedToken(updated)
            return 'lapsed'
        }

        const data = await response.json() as { expiresAt?: number }
        const updated: CachedToken = {
            ...cached,
            expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : 0,
            cachedAt: Date.now(),
        }
        writeCachedToken(updated)
        return 'active'
    } catch (err) {
        // Network failure — fall back to cached state, never fail hard
        console.warn('[auth] online validation failed (non-fatal):', err)
        return checkLicense()
    }
}

/**
 * Stores a new license token (called after purchase/login flow — Sprint 5).
 * The token is encrypted and persisted to disk via safeStorage.
 */
export function storeLicenseToken(token: string, expiresAt: number): void {
    if (!safeStorage.isEncryptionAvailable()) {
        console.warn('[auth] safeStorage not available — cannot store token')
        return
    }
    const cached: CachedToken = {
        token,
        issuedAt: Date.now(),
        expiresAt,
        cachedAt: Date.now(),
    }
    writeCachedToken(cached)
}

/**
 * Clears the stored license token (for logout/reset flows).
 */
export function clearLicenseToken(): void {
    const filePath = getTokenFilePath()
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
    }
}
