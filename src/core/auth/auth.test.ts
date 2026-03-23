/**
 * Auth module tests.
 *
 * Mocks 'electron' (safeStorage, app) and 'fs' to test license state logic
 * without any real file I/O or Electron runtime.
 *
 * Source: src/core/auth/auth.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file by Vitest's transformer.
// Variables declared with const/let CANNOT be referenced inside vi.mock factories
// because those declarations have not run yet at hoist time.
// Solution: use vi.hoisted() to create the mock functions at hoist time.

const {
    mockEncryptString,
    mockDecryptString,
    mockIsEncryptionAvailable,
    mockExistsSync,
    mockReadFileSync,
    mockWriteFileSync,
    mockUnlinkSync,
} = vi.hoisted(() => ({
    mockEncryptString: vi.fn((text: string) => Buffer.from(text)),
    mockDecryptString: vi.fn((buf: Buffer) => buf.toString()),
    mockIsEncryptionAvailable: vi.fn(() => true),
    mockExistsSync: vi.fn(() => false),
    mockReadFileSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
    mockUnlinkSync: vi.fn(),
}))

vi.mock('electron', () => ({
    app: {
        getPath: () => '/tmp/test-auth',
    },
    safeStorage: {
        isEncryptionAvailable: mockIsEncryptionAvailable,
        encryptString: mockEncryptString,
        decryptString: mockDecryptString,
    },
}))

vi.mock('fs', () => ({
    default: {
        existsSync: (...args: unknown[]) => (mockExistsSync as (...a: unknown[]) => unknown)(...args),
        readFileSync: (...args: unknown[]) => (mockReadFileSync as (...a: unknown[]) => unknown)(...args),
        writeFileSync: (...args: unknown[]) => (mockWriteFileSync as (...a: unknown[]) => unknown)(...args),
        unlinkSync: (...args: unknown[]) => (mockUnlinkSync as (...a: unknown[]) => unknown)(...args),
    },
    existsSync: (...args: unknown[]) => (mockExistsSync as (...a: unknown[]) => unknown)(...args),
    readFileSync: (...args: unknown[]) => (mockReadFileSync as (...a: unknown[]) => unknown)(...args),
    writeFileSync: (...args: unknown[]) => (mockWriteFileSync as (...a: unknown[]) => unknown)(...args),
    unlinkSync: (...args: unknown[]) => (mockUnlinkSync as (...a: unknown[]) => unknown)(...args),
}))

// Import after mocks are registered
import { checkLicense, validateOnline } from './auth'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CachedToken {
    token: string
    issuedAt: number
    expiresAt: number
    cachedAt: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockTokenOnDisk(overrides: Partial<CachedToken> = {}): void {
    const token: CachedToken = {
        token: 'test-license-token',
        issuedAt: Date.now() - 1000,
        expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days from now
        cachedAt: Date.now() - 1000,
        ...overrides,
    }
    const json = JSON.stringify(token)
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(Buffer.from(json))
    mockDecryptString.mockReturnValue(json)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    // Restore defaults after clearAllMocks wipes return values
    mockIsEncryptionAvailable.mockReturnValue(true)
    mockExistsSync.mockReturnValue(false)
    delete process.env['LICENSE_SERVER_URL']
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('checkLicense', () => {
    it('returns "unlicensed" when no token file exists', () => {
        mockExistsSync.mockReturnValue(false)
        expect(checkLicense()).toBe('unlicensed')
    })

    it('returns "active" with a valid, unexpired token within TTL', () => {
        mockTokenOnDisk({
            cachedAt: Date.now() - 1000,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        })
        expect(checkLicense()).toBe('active')
    })

    it('returns "grace" when the cache TTL is exceeded (offline >30 days)', () => {
        const thirtyOneDays = 31 * 24 * 60 * 60 * 1000
        mockTokenOnDisk({
            cachedAt: Date.now() - thirtyOneDays,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        })
        expect(checkLicense()).toBe('grace')
    })

    it('returns "lapsed" when subscription expiry is in the past and cache is fresh', () => {
        mockTokenOnDisk({
            cachedAt: Date.now() - 1000,
            expiresAt: Date.now() - 1000, // expired 1 second ago
        })
        expect(checkLicense()).toBe('lapsed')
    })

    it('returns "active" when safeStorage encryption is unavailable (dev/CI fallback)', () => {
        mockIsEncryptionAvailable.mockReturnValue(false)
        expect(checkLicense()).toBe('active')
    })

    it('does not throw when decryption fails — returns "unlicensed" or "grace"', () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(Buffer.from('corrupted-data'))
        mockDecryptString.mockImplementation(() => { throw new Error('decrypt failed') })

        expect(() => checkLicense()).not.toThrow()
        // Corrupted token → readCachedToken returns null → 'unlicensed',
        // unless the outer try/catch catches it → 'grace'
        const result = checkLicense()
        expect(['unlicensed', 'grace']).toContain(result)
    })
})

describe('validateOnline', () => {
    it('returns "active" immediately when LICENSE_SERVER_URL is unset (dev mode)', async () => {
        delete process.env['LICENSE_SERVER_URL']
        const result = await validateOnline()
        expect(result).toBe('active')
    })

    it('returns "active" when LICENSE_SERVER_URL is empty string (treated as unset)', async () => {
        process.env['LICENSE_SERVER_URL'] = ''
        const result = await validateOnline()
        expect(result).toBe('active')
    })

    it('returns "unlicensed" when server URL is set but no token file exists', async () => {
        process.env['LICENSE_SERVER_URL'] = 'https://license.example.com'
        mockExistsSync.mockReturnValue(false)
        const result = await validateOnline()
        expect(result).toBe('unlicensed')
    })
})
