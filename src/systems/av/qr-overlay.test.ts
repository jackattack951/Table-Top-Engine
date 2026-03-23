/**
 * QR Overlay tests — Phase 6.
 *
 * Vitest env is 'node' — no DOM, no real PixiJS.
 * Tests verify module exports, show/hide API, and container management.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── PIXI mock ────────────────────────────────────────────────────────────────

class MockContainer {
    visible = true
    children: unknown[] = []
    parent: MockContainer | null = null
    addChild(child: unknown): unknown {
        this.children.push(child)
        if (typeof child === 'object' && child !== null) {
            (child as MockContainer).parent = this
        }
        return child
    }
    removeChild(child: unknown): void {
        this.children = this.children.filter((c) => c !== child)
    }
}

class MockGraphics {
    rect(): this { return this }
    fill(): this { return this }
    destroy(): void { /* noop */ }
}

class MockText {
    text: string
    anchor = { set: vi.fn() }
    x = 0
    y = 0
    constructor(opts: { text: string }) {
        this.text = opts.text
    }
    destroy(): void { /* noop */ }
}

class MockSprite {
    width = 0
    height = 0
    anchor = { set: vi.fn() }
    x = 0
    y = 0
    destroy(): void { /* noop */ }
}

vi.mock('pixi.js', () => ({
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    Sprite: MockSprite,
    Assets: { load: vi.fn().mockResolvedValue({ _mock: true }), unload: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@shared/output-config', () => ({
    OUTPUT_CONFIG: { width: 1920, height: 1080 },
}))

vi.mock('@shared/color-constants', () => ({
    COLORS: { BLACK: 0x000000 },
}))

// ── Tests ────────────────────────────────────────────────────────────────────

describe('QROverlay module', () => {
    it('exports QROverlay class', async () => {
        const mod = await import('./qr-overlay')
        expect(typeof mod.QROverlay).toBe('function')
    })
})

describe('QROverlay behavior', () => {
    let QROverlay: typeof import('./qr-overlay').QROverlay

    beforeEach(async () => {
        const mod = await import('./qr-overlay')
        QROverlay = mod.QROverlay
    })

    it('starts hidden', () => {
        const uiLayer = new MockContainer()
        const overlay = new QROverlay(uiLayer as never)
        expect(overlay.isVisible()).toBe(false)
    })

    it('show makes it visible', async () => {
        const uiLayer = new MockContainer()
        const overlay = new QROverlay(uiLayer as never)
        await overlay.show('data:image/png;base64,FAKE', 'ABC123')
        expect(overlay.isVisible()).toBe(true)
    })

    it('hide makes it invisible', async () => {
        const uiLayer = new MockContainer()
        const overlay = new QROverlay(uiLayer as never)
        await overlay.show('data:image/png;base64,FAKE', 'ABC123')
        overlay.hide()
        expect(overlay.isVisible()).toBe(false)
    })

    it('destroy cleans up', async () => {
        const uiLayer = new MockContainer()
        const overlay = new QROverlay(uiLayer as never)
        await overlay.show('data:image/png;base64,FAKE', 'ABC123')
        overlay.destroy()
        expect(overlay.isVisible()).toBe(false)
    })
})

describe('Socket event constant', () => {
    it('SESSION_QR_OVERLAY exists', async () => {
        const { EVENTS } = await import('@shared/socket-events')
        expect(EVENTS.SESSION_QR_OVERLAY).toBe('session:qrOverlay')
    })
})

describe('Sync helper', () => {
    it('emitQROverlay is exported', async () => {
        const mod = await import('../../ui/lib/sync')
        expect(typeof mod.emitQROverlay).toBe('function')
    })
})

describe('PlayerSidebar module', () => {
    it('exports PlayerSidebar component', async () => {
        const mod = await import('../../ui/components/player-sidebar')
        expect(typeof mod.PlayerSidebar).toBe('function')
    })
})
