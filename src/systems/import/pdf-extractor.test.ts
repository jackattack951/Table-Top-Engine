/**
 * PDF extractor tests — Sprint 19.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isPDFBuffer } from './pdf-extractor'

// Mock pdfjs-dist for unit tests (no real PDF files needed)
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: vi.fn(),
}))

describe('isPDFBuffer', () => {
    it('returns true for a buffer starting with %PDF-', () => {
        const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34])
        expect(isPDFBuffer(buf)).toBe(true)
    })

    it('returns false for a text file buffer', () => {
        const encoder = new TextEncoder()
        const buf = encoder.encode('# Campaign Document\n\nSome text')
        expect(isPDFBuffer(buf)).toBe(false)
    })

    it('returns false for an empty buffer', () => {
        expect(isPDFBuffer(new Uint8Array(0))).toBe(false)
    })

    it('returns false for a short buffer', () => {
        expect(isPDFBuffer(new Uint8Array([0x25, 0x50]))).toBe(false)
    })
})

describe('extractTextFromPDF', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('extracts text from pages and joins them', async () => {
        // Set up the mock to return a fake PDF document
        const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const mockGetDocument = vi.mocked(getDocument)

        const mockDoc = {
            numPages: 2,
            getPage: vi.fn().mockImplementation((pageNum: number) => ({
                getTextContent: vi.fn().mockResolvedValue({
                    items: pageNum === 1
                        ? [{ str: 'Page one' }, { str: ' content here.' }]
                        : [{ str: 'Scene 1: The Tavern' }, { str: ' — A dark place.' }],
                }),
            })),
        }

        mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockDoc) } as ReturnType<typeof getDocument>)

        const { extractTextFromPDF } = await import('./pdf-extractor')
        const result = await extractTextFromPDF(new Uint8Array([0x25, 0x50, 0x44, 0x46]))

        expect(result).toContain('Page one content here.')
        expect(result).toContain('Scene 1: The Tavern')
        expect(mockDoc.getPage).toHaveBeenCalledTimes(2)
    })

    it('skips empty pages', async () => {
        const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const mockGetDocument = vi.mocked(getDocument)

        const mockDoc = {
            numPages: 3,
            getPage: vi.fn().mockImplementation((pageNum: number) => ({
                getTextContent: vi.fn().mockResolvedValue({
                    items: pageNum === 2
                        ? [] // Empty page
                        : [{ str: `Page ${pageNum} text` }],
                }),
            })),
        }

        mockGetDocument.mockReturnValue({ promise: Promise.resolve(mockDoc) } as ReturnType<typeof getDocument>)

        const { extractTextFromPDF } = await import('./pdf-extractor')
        const result = await extractTextFromPDF(new Uint8Array([0x25, 0x50, 0x44, 0x46]))

        expect(result).toContain('Page 1 text')
        expect(result).toContain('Page 3 text')
        // No empty section between page 1 and 3
        expect(result).not.toContain('\n\n\n\n')
    })
})
