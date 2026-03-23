/**
 * CodeMirror 6 wikilink extension — Sprint 15e.
 *
 * Provides:
 * 1. Autocomplete triggered by `[[` — fuzzy-searches all note titles
 * 2. Decoration — styles `[[...]]` spans with .cm-wikilink class
 * 3. Click handler — clicking a decorated wikilink navigates to the target note
 */
import { EditorView, ViewPlugin, Decoration, type ViewUpdate, type DecorationSet } from '@codemirror/view'
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import type { Range } from '@codemirror/state'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WikilinkNote {
    id: string
    title: string
}

export type WikilinkNavigate = (noteTitle: string) => void

// ── Wikilink Decoration ──────────────────────────────────────────────────────

const wikilinkDeco = Decoration.mark({ class: 'cm-wikilink' })
const wikilinkBrokenDeco = Decoration.mark({ class: 'cm-wikilink cm-wikilink--broken' })

function buildWikilinkDecorations(view: EditorView, noteTitles: Set<string>): DecorationSet {
    const widgets: Range<Decoration>[] = []
    const doc = view.state.doc.toString()
    const pattern = /\[\[([^\]]+)\]\]/g
    let match
    while ((match = pattern.exec(doc)) !== null) {
        const title = match[1]!.trim()
        const deco = noteTitles.has(title.toLowerCase()) ? wikilinkDeco : wikilinkBrokenDeco
        widgets.push(deco.range(match.index, match.index + match[0].length))
    }
    return Decoration.set(widgets)
}

/**
 * Creates a ViewPlugin that decorates `[[...]]` spans in the editor.
 * Requires a getter function that returns the current set of lowercase note titles.
 */
function wikilinkDecoPlugin(getNoteTitles: () => Set<string>) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet
            constructor(view: EditorView) {
                this.decorations = buildWikilinkDecorations(view, getNoteTitles())
            }
            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = buildWikilinkDecorations(update.view, getNoteTitles())
                }
            }
        },
        { decorations: (v) => v.decorations },
    )
}

// ── Wikilink Autocomplete ────────────────────────────────────────────────────

/**
 * Creates a completion source triggered by `[[`.
 * Fuzzy-matches note titles as the user types.
 */
function wikilinkCompletionSource(getNotes: () => WikilinkNote[]) {
    return (context: CompletionContext): CompletionResult | null => {
        // Look back for `[[` — the trigger
        const line = context.state.doc.lineAt(context.pos)
        const textBefore = line.text.slice(0, context.pos - line.from)

        // Find the last `[[` that hasn't been closed
        const triggerIdx = textBefore.lastIndexOf('[[')
        if (triggerIdx === -1) return null

        // Check there's no `]]` between the trigger and cursor
        const afterTrigger = textBefore.slice(triggerIdx + 2)
        if (afterTrigger.includes(']]')) return null

        const query = afterTrigger.toLowerCase()
        const from = line.from + triggerIdx + 2 // position after `[[`

        const notes = getNotes()
        const options = notes
            .filter((n) => n.title.toLowerCase().includes(query))
            .slice(0, 20) // limit results
            .map((n) => ({
                label: n.title,
                apply: `${n.title}]]`,
                type: 'text' as const,
            }))

        if (options.length === 0) return null

        return {
            from,
            to: context.pos,
            options,
            filter: false, // we already filtered
        }
    }
}

// ── Click Handler ────────────────────────────────────────────────────────────

/**
 * Creates an EditorView event handler that intercepts clicks on wikilink decorations.
 * When a `[[Title]]` span is clicked, calls the navigate callback.
 */
function wikilinkClickHandler(onNavigate: WikilinkNavigate) {
    return EditorView.domEventHandlers({
        click(event: MouseEvent, view: EditorView) {
            const target = event.target as HTMLElement
            // Check if clicked element or parent has the wikilink class
            const wikilinkEl = target.closest('.cm-wikilink')
            if (!wikilinkEl) return false

            // Extract the note title from the text content
            const text = wikilinkEl.textContent ?? ''
            const match = text.match(/^\[\[(.+)\]\]$/)
            if (match?.[1]) {
                event.preventDefault()
                onNavigate(match[1].trim())
                return true
            }
            return false
        },
    })
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface WikilinkExtensionOptions {
    /** Returns the current list of all notes (id + title) for autocomplete */
    getNotes: () => WikilinkNote[]
    /** Called when a wikilink is clicked in the editor */
    onNavigate: WikilinkNavigate
}

/**
 * Creates the full set of CodeMirror extensions for wikilink support.
 * Returns an array of extensions to spread into the EditorState extensions list.
 */
export function wikilinkExtension(options: WikilinkExtensionOptions) {
    // Build a lowercase title set from the notes list for decoration matching
    const getNoteTitles = () => {
        const titles = new Set<string>()
        for (const n of options.getNotes()) {
            titles.add(n.title.toLowerCase())
        }
        return titles
    }

    return [
        wikilinkDecoPlugin(getNoteTitles),
        autocompletion({
            override: [wikilinkCompletionSource(options.getNotes)],
            activateOnTyping: true,
        }),
        wikilinkClickHandler(options.onNavigate),
    ]
}
