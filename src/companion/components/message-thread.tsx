/**
 * MessageThread — bidirectional player ↔ DM chat panel on companion.
 * Player can send messages to the DM and see replies.
 * Sprint 21a.
 */
import { useState, useRef, useEffect } from 'react'
import { useCompanionStore } from '../stores/companion-store'
import { companionEmit } from '../lib/companion-sync'
import { EVENTS } from '@shared/socket-events'
import type { PlayerMessage } from '@shared/player-types'
import { formatTime } from '@shared/player-types'
import { vibrate } from '../lib/haptics'

// ── Raise Hand Button ─────────────────────────────────────────────────────────

function RaiseHandButton(): JSX.Element {
    const handRaised = useCompanionStore((s) => s.handRaised)
    const setHandRaised = useCompanionStore((s) => s.setHandRaised)

    function toggle(): void {
        const next = !handRaised
        setHandRaised(next)
        companionEmit(EVENTS.PLAYER_RAISE_HAND, { raised: next })
        vibrate(50)
    }

    return (
        <button
            className={`message-thread__raise-hand${handRaised ? ' message-thread__raise-hand--active' : ''}`}
            onClick={toggle}
            aria-pressed={handRaised}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
        >
            <span aria-hidden="true">✋</span>
            {handRaised ? 'Lower Hand' : 'Raise Hand'}
        </button>
    )
}

// ── Individual Message Bubble ─────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: PlayerMessage }): JSX.Element {
    const cls = msg.fromDM ? 'message-thread__bubble message-thread__bubble--dm' : 'message-thread__bubble message-thread__bubble--player'
    return (
        <div className={cls}>
            <span className="message-thread__bubble-label">{msg.fromDM ? 'DM' : 'You'}</span>
            <span className="message-thread__bubble-text">{msg.message}</span>
            <span className="message-thread__bubble-time">{formatTime(msg.timestamp)}</span>
        </div>
    )
}

// ── Main Thread ───────────────────────────────────────────────────────────────

export function MessageThread(): JSX.Element {
    const messages = useCompanionStore((s) => s.messages)
    const [draft, setDraft] = useState('')
    const bottomRef = useRef<HTMLDivElement | null>(null)

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length])

    function send(): void {
        const text = draft.trim()
        if (!text) return
        companionEmit(EVENTS.PLAYER_SEND_MESSAGE, { message: text })
        setDraft('')
        vibrate(30)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
        }
    }

    return (
        <div className="message-thread">
            <div className="message-thread__header">
                <span className="dashboard__section-label">Message DM</span>
                <RaiseHandButton />
            </div>

            <div className="message-thread__list">
                {messages.length === 0 ? (
                    <p className="message-thread__empty">No messages yet. Say something!</p>
                ) : (
                    messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
                )}
                <div ref={bottomRef} />
            </div>

            <div className="message-thread__input-row">
                <input
                    className="form-input message-thread__input"
                    type="text"
                    placeholder="Message the DM…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={500}
                />
                <button
                    className="btn btn-primary message-thread__send"
                    onClick={send}
                    disabled={!draft.trim()}
                >
                    Send
                </button>
            </div>
        </div>
    )
}
