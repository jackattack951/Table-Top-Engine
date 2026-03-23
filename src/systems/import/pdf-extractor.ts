/**
 * PDF Text Extractor — Sprint 19.
 * Extracts plain text from PDF files page-by-page using pdfjs-dist.
 * Pure utility — no side effects, no file system access.
 * Used by the Document Import Modal to support PDF uploads.
 */

import type { TextItem } from 'pdfjs-dist/types/src/display/api'

/** Cached pdfjs-dist module import (resolved once, reused on subsequent calls) */
let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null
function getPdfjs() {
    if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
    return pdfjsPromise
}

/**
 * Extract all text content from a PDF buffer, page by page.
 * Returns a single string with pages separated by double newlines.
 */
export async function extractTextFromPDF(data: Uint8Array): Promise<string> {
    const pdfjsLib = await getPdfjs()

    const doc = await pdfjsLib.getDocument({ data }).promise
    const pages: string[] = []

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()

        // Join text items, preserving spacing
        const text = content.items
            .filter((item): item is TextItem => 'str' in item)
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()

        if (text.length > 0) {
            pages.push(text)
        }
    }

    return pages.join('\n\n')
}

/**
 * Check if a file's content starts with the PDF magic number (%PDF-).
 */
export function isPDFBuffer(data: Uint8Array): boolean {
    if (data.length < 5) return false
    // %PDF- in ASCII
    return data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44
        && data[3] === 0x46 && data[4] === 0x2D
}
