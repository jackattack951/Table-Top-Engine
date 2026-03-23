/**
 * Minimal Markdown renderer for DM notes.
 * Extracted from NotesTab (Sprint 4) for reuse by NoteEditor preview mode.
 *
 * Supported syntax (no external library — intentional per architecture rules):
 *   **bold**              → <strong>
 *   *italic*              → <em>
 *   [Trigger: Label]      → <button class="scene-trigger-btn">
 *   [[Note Title]]        → <span class="wikilink"> (clickable, Sprint 15e)
 *   \n                    → <br />
 */
import React from 'react'

export interface ParseNotesOptions {
    onTrigger: (label: string) => void
    /** Called when a [[wikilink]] is clicked. If omitted, wikilinks render as plain text. */
    onWikilinkClick?: (title: string) => void
    /** Set of lowercase note titles that exist. Used to style broken links. */
    knownTitles?: Set<string>
}

export function parseNotes(
    text: string,
    onTriggerOrOptions: ((label: string) => void) | ParseNotesOptions,
): React.ReactNode[] {
    // Support both legacy signature and new options object
    const opts: ParseNotesOptions = typeof onTriggerOrOptions === 'function'
        ? { onTrigger: onTriggerOrOptions }
        : onTriggerOrOptions

    const nodes: React.ReactNode[] = []
    const lines = text.split('\n')

    lines.forEach((line, lineIdx) => {
        if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />)

        // Parse inline patterns: wikilinks, triggers, bold, italic
        const pattern = /\[\[([^\]]+)\]\]|\[Trigger:\s*([^\]]+)\]|\*\*([^*]+)\*\*|\*([^*]+)\*/g
        let lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = pattern.exec(line)) !== null) {
            if (match.index > lastIndex) {
                nodes.push(line.slice(lastIndex, match.index))
            }

            if (match[1] !== undefined) {
                // [[Wikilink]]
                const title = match[1].trim()
                const isBroken = opts.knownTitles ? !opts.knownTitles.has(title.toLowerCase()) : false

                if (opts.onWikilinkClick) {
                    nodes.push(
                        <span
                            key={`wikilink-${lineIdx}-${match.index}`}
                            className={`wikilink${isBroken ? ' wikilink--broken' : ''}`}
                            role="link"
                            tabIndex={0}
                            onClick={() => opts.onWikilinkClick!(title)}
                            onKeyDown={(e) => { if (e.key === 'Enter') opts.onWikilinkClick!(title) }}
                            title={isBroken ? 'Note not found' : title}
                        >
                            {title}
                        </span>,
                    )
                } else {
                    // No click handler — render as styled text
                    nodes.push(
                        <span
                            key={`wikilink-${lineIdx}-${match.index}`}
                            className={`wikilink wikilink--readonly${isBroken ? ' wikilink--broken' : ''}`}
                        >
                            {title}
                        </span>,
                    )
                }
            } else if (match[2] !== undefined) {
                // [Trigger: Label]
                const label = match[2].trim()
                nodes.push(
                    <button
                        key={`trigger-${lineIdx}-${match.index}`}
                        className="scene-trigger-btn"
                        onClick={() => opts.onTrigger(label)}
                        type="button"
                        aria-label={`Fire trigger: ${label}`}
                    >
                        {label}
                    </button>,
                )
            } else if (match[3] !== undefined) {
                nodes.push(<strong key={`bold-${lineIdx}-${match.index}`}>{match[3]}</strong>)
            } else if (match[4] !== undefined) {
                nodes.push(<em key={`em-${lineIdx}-${match.index}`}>{match[4]}</em>)
            }

            lastIndex = match.index + match[0].length
        }

        if (lastIndex < line.length) {
            nodes.push(line.slice(lastIndex))
        }
    })

    return nodes
}
