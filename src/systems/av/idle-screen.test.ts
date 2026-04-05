/**
 * IdleScreen tests — Sprint 22c.
 *
 * Vitest env is 'node' — no DOM, no real PixiJS.
 * Verifies show/hide lifecycle, addChildAt placement, and RAF cleanup.
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

    addChildAt(child: unknown, index: number): unknown {
        this.children.splice(index, 0, child)
        if (typeof child === 'object' && child !== null) {
            (child as MockContainer).parent = this
        }
        return child
    }

    removeChild(child: unknown): void {
        this.children = this.children.filter((c) => c !== child)
    }

    destroy(): void { /* noop */ }
}

class MockGraphics {
    _cleared = false
    rect(): this { return this }
    fill(): this { return this }
    circle(): this { return this }
    stroke(): this { return this }
    clear(): this { this._cleared = true; return this }
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

class MockImageSource {
    constructor(_opts: { resource: unknown }) {}
}

class MockTexture {
    constructor(_opts?: { source: unknown }) {}
}

class MockApplication {
    stage = new MockContainer()
}

vi.mock('pixi.js', () => ({
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    Sprite: MockSprite,
    ImageSource: MockImageSource,
    Texture: MockTexture,
    Application: MockApplication,
}))

vi.mock('@shared/output-config', () => ({
    OUTPUT_CONFIG: { width: 1920, height: 1080 },
}))

vi.mock('qrcode', () => ({
    default: {
        toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
    },
}))

// ── Browser API stubs ─────────────────────────────────────────────────────────

class MockImage {
    src = ''
    async decode(): Promise<void> { /* noop */ }
}
vi.stubGlobal('Image', MockImage)

let rafIdCounter = 0
const rafMock = vi.fn((_cb: (now: number) => void): number => ++rafIdCounter)
const cancelRafMock = vi.fn()
vi.stubGlobal('requestAnimationFrame', rafMock)
vi.stubGlobal('cancelAnimationFrame', cancelRafMock)
vi.stubGlobal('performance', { now: () => 0 })

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeIdleScreen(): Promise<{
    IdleScreen: typeof import('./idle-screen').IdleScreen
    app: MockApplication
}> {
    const mod = await import('./idle-screen')
    const app = new MockApplication()
    return { IdleScreen: mod.IdleScreen, app }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IdleScreen module', () => {
    it('exports IdleScreen class', async () => {
        const mod = await import('./idle-screen')
        expect(typeof mod.IdleScreen).toBe('function')
    })
})

describe('IdleScreen construction', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('inserts container at stage index 0 via addChildAt', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const addChildAtSpy = vi.spyOn(app.stage, 'addChildAt')
        new IdleScreen(app as unknown as import('pixi.js').Application)
        expect(addChildAtSpy).toHaveBeenCalledWith(expect.any(MockContainer), 0)
    })

    it('starts hidden', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        expect(screen.isVisible()).toBe(false)
    })
})

describe('IdleScreen show/hide', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('becomes visible after show()', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        await screen.show(null, null)
        expect(screen.isVisible()).toBe(true)
    })

    it('hides after hide()', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        await screen.show(null, null)
        screen.hide()
        expect(screen.isVisible()).toBe(false)
    })

    it('adds children on show and clears them on hide', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        // The container is the first child of stage
        const container = app.stage.children[0] as MockContainer
        await screen.show(null, null)
        expect(container.children.length).toBeGreaterThan(0)
        screen.hide()
        expect(container.children.length).toBe(0)
    })

    it('starts RAF glow loop on show', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        await screen.show(null, null)
        expect(rafMock).toHaveBeenCalled()
    })

    it('cancels RAF on hide — no leak', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        await screen.show(null, null)
        screen.hide()
        expect(cancelRafMock).toHaveBeenCalled()
    })

    it('cancels RAF on destroy', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        await screen.show(null, null)
        screen.destroy()
        expect(cancelRafMock).toHaveBeenCalled()
    })
})

describe('IdleScreen QR code', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('calls QRCode.toDataURL when companionUrl is provided', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const QRCode = (await import('qrcode')).default
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        await screen.show('TEST-CODE', 'http://192.168.1.1:8080/companion')
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
            'http://192.168.1.1:8080/companion',
            expect.any(Object),
        )
    })

    it('skips QR generation when companionUrl is null and no cached url', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const QRCode = (await import('qrcode')).default
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        await screen.show(null, null)
        expect(QRCode.toDataURL).not.toHaveBeenCalled()
    })

    it('uses cached companionUrl on subsequent show() calls', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const QRCode = (await import('qrcode')).default
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        await screen.show('CODE', 'http://192.168.1.1:8080/companion')
        vi.clearAllMocks()
        // Second show() with null URL — should reuse cached
        await screen.show(null, null)
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
            'http://192.168.1.1:8080/companion',
            expect.any(Object),
        )
    })
})

describe('IdleScreen destroy', () => {
    it('removes container from stage parent', async () => {
        const { IdleScreen, app } = await makeIdleScreen()
        const screen = new IdleScreen(app as unknown as import('pixi.js').Application)
        const container = app.stage.children[0] as MockContainer
        expect(container.parent).toBe(app.stage)
        screen.destroy()
        // Parent's removeChild clears the parent reference via MockContainer logic
        expect(app.stage.children).not.toContain(container)
    })
})
