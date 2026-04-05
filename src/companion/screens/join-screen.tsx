/**
 * JoinScreen — mobile-first form for players to enter character details and join a session.
 *
 * The session code can be pre-filled from URL params (?session=ABCD23) or entered manually.
 * When a session code is entered, fetches session info to determine character select mode:
 *   - manual-only: show full character form (current behavior)
 *   - roster-only: show roster picker; selected character pre-fills (no manual editing)
 *   - roster-and-manual: show roster picker + option to fill in manually
 *
 * On submit, emits PLAYER_JOIN via companion-sync → server assigns token → phase moves to 'lobby'.
 */
import React, { useState, useEffect } from 'react'
import { EVENTS } from '@shared/socket-events'
import type { RosterCharacter, CharacterSelectMode } from '@shared/player-types'
import { useCompanionStore } from '../stores/companion-store'
import { companionEmit, initCompanionSync, getSavedToken, getSavedSessionCode } from '../lib/companion-sync'

// D&D 5e class list
const CLASSES = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
    'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
    'Warlock', 'Wizard',
] as const

const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const

const DEFAULT_ABILITIES = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }

export function JoinScreen(): React.JSX.Element {
    // Form state
    const [playerName, setPlayerName] = useState('')
    const [characterName, setCharacterName] = useState('')
    const [charClass, setCharClass] = useState('Fighter')
    const [level, setLevel] = useState(1)
    const [hp, setHp] = useState(10)
    const [maxHp, setMaxHp] = useState(10)
    const [ac, setAc] = useState(10)
    const [abilities, setAbilities] = useState(DEFAULT_ABILITIES)
    const [sessionCode, setSessionCode] = useState('')

    // Character select state
    const [selectMode, setSelectMode] = useState<CharacterSelectMode>('manual-only')
    const [roster, setRoster] = useState<RosterCharacter[]>([])
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
    const [rosterFetched, setRosterFetched] = useState(false)

    const error = useCompanionStore((s) => s.error)
    const loading = useCompanionStore((s) => s.loading)

    // Extract session code from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('session')
        if (code) {
            setSessionCode(code.toUpperCase())
        }
    }, [])

    // Try to reconnect with saved token on mount
    useEffect(() => {
        const savedToken = getSavedToken()
        const savedCode = getSavedSessionCode()
        if (savedToken && savedCode) {
            initCompanionSync(savedCode)
        }
    }, [])

    // Fetch session info when a 6-char code is entered
    useEffect(() => {
        setRosterFetched(false)
        setSelectedCharId(null)

        if (sessionCode.length !== 6) {
            setSelectMode('manual-only')
            setRoster([])
            return
        }

        const controller = new AbortController()
        const serverUrl = window.location.origin
        fetch(`${serverUrl}/api/sessions/${sessionCode}/info`, { signal: controller.signal })
            .then((res) => {
                if (!res.ok) throw new Error('not ok')
                return res.json() as Promise<{ characterSelectMode: CharacterSelectMode; characters: RosterCharacter[] }>
            })
            .then((data) => {
                setSelectMode(data.characterSelectMode)
                setRoster(data.characters)
                setRosterFetched(true)
            })
            .catch((err: unknown) => {
                if (err instanceof Error && err.name === 'AbortError') return
                // Session lookup failed — fall back to manual mode
                setRosterFetched(true)
            })

        return () => controller.abort()
    }, [sessionCode])

    function applyRosterCharacter(char: RosterCharacter): void {
        setSelectedCharId(char.id)
        setCharacterName(char.characterName)
        setCharClass(char.class)
        setLevel(char.level)
        setMaxHp(char.maxHp)
        setHp(char.maxHp)
        setAc(char.ac)
        setAbilities({ ...DEFAULT_ABILITIES, ...char.abilities })
    }

    function clearRosterSelection(): void {
        setSelectedCharId(null)
        setCharacterName('')
        setCharClass('Fighter')
        setLevel(1)
        setMaxHp(10)
        setHp(10)
        setAc(10)
        setAbilities(DEFAULT_ABILITIES)
    }

    function handleAbilityChange(ability: typeof ABILITY_NAMES[number], value: string): void {
        const num = parseInt(value, 10)
        if (!isNaN(num)) {
            setAbilities((prev) => ({ ...prev, [ability]: Math.max(1, Math.min(30, num)) }))
        }
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
        e.preventDefault()
        if (!playerName.trim() || !characterName.trim() || !sessionCode.trim()) {
            useCompanionStore.getState().setError('All fields are required')
            return
        }

        const code = sessionCode.trim().toUpperCase()
        useCompanionStore.getState().setLoading(true)
        useCompanionStore.getState().setError(null)

        initCompanionSync(code)

        setTimeout(() => {
            companionEmit(EVENTS.PLAYER_JOIN, {
                sessionCode: code,
                playerName: playerName.trim(),
                characterName: characterName.trim(),
                class: charClass,
                level,
                hp,
                maxHp,
                ac,
                abilities,
            })
        }, 150)
    }

    const showRoster = rosterFetched && (selectMode === 'roster-only' || selectMode === 'roster-and-manual') && roster.length > 0
    const rosterSelected = selectedCharId !== null
    const formDisabled = selectMode === 'roster-only' && rosterSelected
    const showManualForm = selectMode !== 'roster-only' || !rosterSelected
    const canSubmit = playerName.trim() !== '' && characterName.trim() !== '' && sessionCode.trim() !== '' && !loading
        && (selectMode !== 'roster-only' || rosterSelected)

    return (
        <div className="join-screen">
            <div className="join-screen__header join-screen__stagger" style={{ animationDelay: '0s' }}>
                <h1 className="join-screen__title">Join Session</h1>
                <p className="join-screen__subtitle">Enter your character details to join</p>
            </div>

            <form className="join-screen__form" onSubmit={handleSubmit}>
                {/* Session Code */}
                <div className="join-screen__field join-screen__stagger" style={{ animationDelay: '0.05s' }}>
                    <label className="join-screen__label" htmlFor="session-code">
                        Session Code
                    </label>
                    <input
                        id="session-code"
                        className="form-input join-screen__code-input"
                        type="text"
                        placeholder="e.g. ABC123"
                        value={sessionCode}
                        onChange={(e) => setSessionCode(e.target.value.toUpperCase().slice(0, 6))}
                        maxLength={6}
                        autoComplete="off"
                        required
                    />
                </div>

                <div className="join-screen__divider join-screen__stagger" style={{ animationDelay: '0.1s' }} />

                {/* Character Roster Picker */}
                {showRoster && (
                    <div className="join-screen__field join-screen__stagger" style={{ animationDelay: '0.12s' }}>
                        <label className="join-screen__label">Choose Your Character</label>
                        <div className="join-screen__roster">
                            {roster.map((char) => (
                                <button
                                    key={char.id}
                                    type="button"
                                    className={`join-screen__roster-card${selectedCharId === char.id ? ' join-screen__roster-card--selected' : ''}`}
                                    onClick={() => selectedCharId === char.id ? clearRosterSelection() : applyRosterCharacter(char)}
                                >
                                    <span className="join-screen__roster-name">{char.characterName}</span>
                                    <span className="join-screen__roster-meta">Lv{char.level} {char.class} · {char.maxHp} HP · AC {char.ac}</span>
                                </button>
                            ))}
                            {selectMode === 'roster-and-manual' && (
                                <button
                                    type="button"
                                    className={`join-screen__roster-card join-screen__roster-card--manual${!rosterSelected ? ' join-screen__roster-card--selected' : ''}`}
                                    onClick={clearRosterSelection}
                                >
                                    <span className="join-screen__roster-name">Enter Manually</span>
                                    <span className="join-screen__roster-meta">Fill in your own character details</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Player name always shown */}
                <div className="join-screen__row join-screen__stagger" style={{ animationDelay: '0.15s' }}>
                    <div className="join-screen__field">
                        <label className="join-screen__label" htmlFor="player-name">
                            Player Name
                        </label>
                        <input
                            id="player-name"
                            className="form-input"
                            type="text"
                            placeholder="Your name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            maxLength={50}
                            required
                        />
                    </div>
                    {showManualForm && (
                        <div className="join-screen__field">
                            <label className="join-screen__label" htmlFor="char-name">
                                Character Name
                            </label>
                            <input
                                id="char-name"
                                className="form-input"
                                type="text"
                                placeholder="Character name"
                                value={characterName}
                                onChange={(e) => setCharacterName(e.target.value)}
                                maxLength={50}
                                disabled={formDisabled}
                                required
                            />
                        </div>
                    )}
                    {!showManualForm && rosterSelected && (
                        <div className="join-screen__field">
                            <label className="join-screen__label">Character</label>
                            <div className="form-input join-screen__readonly">{characterName}</div>
                        </div>
                    )}
                </div>

                {showManualForm && (
                    <>
                        {/* Class & Level */}
                        <div className="join-screen__row join-screen__stagger" style={{ animationDelay: '0.2s' }}>
                            <div className="join-screen__field join-screen__field--grow">
                                <label className="join-screen__label" htmlFor="char-class">
                                    Class
                                </label>
                                <select
                                    id="char-class"
                                    className="form-select"
                                    value={charClass}
                                    onChange={(e) => setCharClass(e.target.value)}
                                    disabled={formDisabled}
                                >
                                    {CLASSES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="join-screen__field join-screen__field--narrow">
                                <label className="join-screen__label" htmlFor="char-level">
                                    Level
                                </label>
                                <input
                                    id="char-level"
                                    className="form-input"
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={level}
                                    onChange={(e) => setLevel(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                                    disabled={formDisabled}
                                />
                            </div>
                        </div>

                        {/* HP & AC */}
                        <div className="join-screen__row join-screen__row--thirds join-screen__stagger" style={{ animationDelay: '0.25s' }}>
                            <div className="join-screen__field">
                                <label className="join-screen__label" htmlFor="char-hp">
                                    HP
                                </label>
                                <input
                                    id="char-hp"
                                    className="form-input"
                                    type="number"
                                    min={1}
                                    max={999}
                                    value={hp}
                                    onChange={(e) => setHp(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    disabled={formDisabled}
                                />
                            </div>
                            <div className="join-screen__field">
                                <label className="join-screen__label" htmlFor="char-maxhp">
                                    Max HP
                                </label>
                                <input
                                    id="char-maxhp"
                                    className="form-input"
                                    type="number"
                                    min={1}
                                    max={999}
                                    value={maxHp}
                                    onChange={(e) => setMaxHp(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    disabled={formDisabled}
                                />
                            </div>
                            <div className="join-screen__field">
                                <label className="join-screen__label" htmlFor="char-ac">
                                    AC
                                </label>
                                <input
                                    id="char-ac"
                                    className="form-input"
                                    type="number"
                                    min={0}
                                    max={99}
                                    value={ac}
                                    onChange={(e) => setAc(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    disabled={formDisabled}
                                />
                            </div>
                        </div>

                        {/* Ability Scores */}
                        <div className="join-screen__field join-screen__stagger" style={{ animationDelay: '0.3s' }}>
                            <label className="join-screen__label">Ability Scores</label>
                            <div className="join-screen__abilities">
                                {ABILITY_NAMES.map((ability) => (
                                    <div key={ability} className="join-screen__ability">
                                        <span className="join-screen__ability-label">{ability}</span>
                                        <input
                                            className="form-input join-screen__ability-input"
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={abilities[ability]}
                                            onChange={(e) => handleAbilityChange(ability, e.target.value)}
                                            aria-label={`${ability} score`}
                                            disabled={formDisabled}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Error display */}
                {error && (
                    <div key={error} className="join-screen__error join-screen__error--shake" role="alert">
                        {error}
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    className="btn btn-primary join-screen__submit join-screen__stagger"
                    style={{ animationDelay: '0.35s' }}
                    disabled={!canSubmit}
                >
                    {loading ? 'Joining…' : 'Join Session'}
                </button>
            </form>
        </div>
    )
}
