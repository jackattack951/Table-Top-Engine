/**
 * Bitfocus Companion module for TTRPG Stage Manager.
 *
 * Connects to the Stage Manager Express/Socket.io server and exposes:
 *   - Actions: cockpit commands (mood, scene, SFX, combat, presets, FX overlays)
 *   - Feedbacks: button visual states (connection, mood level, active combatant)
 *   - Variables: live values for use in Companion button labels
 *
 * Usage:
 *   const module = new CompanionModule()
 *   module.connect({ host: '192.168.1.50', port: 3000 }, (state) => updateUI(state))
 */
import { io, Socket } from 'socket.io-client'
import { EVENTS } from '@shared/socket-events'
import { ENVIRONMENT_PRESETS } from '@assets/presets/environment-presets'
import type {
  CompanionConfig,
  CompanionAction,
  CompanionFeedback,
  CompanionVariable,
  ModuleState,
} from './types'

export class CompanionModule {
  private socket: Socket | null = null
  private config: CompanionConfig = { host: '127.0.0.1', port: 3000 }
  private state: ModuleState = {
    connected: false,
    moodValue: 0.3,
    activeSceneId: null,
    combatRound: 1,
    activeCombatantName: null,
    appMode: 'play',
  }
  private onStateChange: ((state: ModuleState) => void) | null = null

  /**
   * Connect to the Stage Manager server.
   * Auto-reconnects on disconnect (handles iPad sleep/wake without intervention).
   *
   * @param config - Partial config to override defaults (host/port)
   * @param onStateChange - Optional callback invoked whenever module state changes
   */
  connect(config: Partial<CompanionConfig> = {}, onStateChange?: (state: ModuleState) => void): void {
    this.config = { ...this.config, ...config }
    this.onStateChange = onStateChange ?? null
    this._connect()
  }

  private _connect(): void {
    this.socket = io(`http://${this.config.host}:${this.config.port}`, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    })

    this.socket.on('connect', () => {
      this._updateState({ connected: true })
      this.socket!.emit(EVENTS.CLIENT_JOIN, { room: 'cockpit' })
    })

    this.socket.on('disconnect', () => {
      this._updateState({ connected: false })
    })

    // Inbound: server → module state
    this.socket.on(EVENTS.STATE_SYNC, (data: unknown) => {
      const payload = data as {
        moodValue?: number
        activeSceneId?: string | null
        appMode?: ModuleState['appMode']
      }
      this._updateState({
        moodValue: payload.moodValue ?? this.state.moodValue,
        activeSceneId: payload.activeSceneId ?? this.state.activeSceneId,
        appMode: payload.appMode ?? this.state.appMode,
      })
    })

    this.socket.on(EVENTS.MOOD_UPDATE, (data: unknown) => {
      const { value } = data as { value: number }
      this._updateState({ moodValue: value })
    })

    this.socket.on(EVENTS.COMBAT_SYNC, (data: unknown) => {
      const combatData = data as {
        round?: number
        combatants?: Array<{ name: string }>
        currentTurnIndex?: number
      }
      this._updateState({
        combatRound: combatData.round ?? this.state.combatRound,
        activeCombatantName:
          combatData.combatants?.[combatData.currentTurnIndex ?? 0]?.name ?? null,
      })
    })
  }

  /** Disconnect from the server and clean up the socket. */
  disconnect(): void {
    this.socket?.disconnect()
    this.socket = null
    this._updateState({ connected: false })
  }

  private _updateState(patch: Partial<ModuleState>): void {
    this.state = { ...this.state, ...patch }
    this.onStateChange?.(this.state)
  }

  /** Returns a shallow copy of current module state. */
  getState(): ModuleState {
    return { ...this.state }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * All available Companion actions.
   * Each action maps to one or more Socket.io events emitted to the server.
   */
  readonly actions: Record<string, CompanionAction> = {

    scene_load: {
      label: 'Load Scene',
      description: 'Load a scene by ID onto the AV display',
      options: [{ id: 'scene_id', label: 'Scene ID', type: 'textinput', default: '' }],
      callback: ({ options }) => {
        this.socket?.emit(EVENTS.SCENE_LOAD, { sceneId: String(options['scene_id']) })
      },
    },

    mood_set: {
      label: 'Set Mood',
      description: 'Set the atmosphere mood slider (0–100)',
      options: [{ id: 'value', label: 'Mood (0–100)', type: 'number', default: 30, min: 0, max: 100 }],
      callback: ({ options }) => {
        const value = Math.max(0, Math.min(100, Number(options['value']))) / 100
        this.socket?.emit(EVENTS.MOOD_UPDATE, { value })
        this._updateState({ moodValue: value })
      },
    },

    mood_increment: {
      label: 'Mood Up',
      description: 'Increase mood by a step amount',
      options: [{ id: 'step', label: 'Step (1–25)', type: 'number', default: 10, min: 1, max: 25 }],
      callback: ({ options }) => {
        const step = Number(options['step']) / 100
        const value = Math.min(1.0, this.state.moodValue + step)
        this.socket?.emit(EVENTS.MOOD_UPDATE, { value })
        this._updateState({ moodValue: value })
      },
    },

    mood_decrement: {
      label: 'Mood Down',
      description: 'Decrease mood by a step amount',
      options: [{ id: 'step', label: 'Step (1–25)', type: 'number', default: 10, min: 1, max: 25 }],
      callback: ({ options }) => {
        const step = Number(options['step']) / 100
        const value = Math.max(0.0, this.state.moodValue - step)
        this.socket?.emit(EVENTS.MOOD_UPDATE, { value })
        this._updateState({ moodValue: value })
      },
    },

    sfx_trigger: {
      label: 'Trigger SFX',
      description: 'Play a sound effect clip with optional spatial positioning',
      options: [
        { id: 'clip_id', label: 'Clip ID', type: 'textinput', default: '' },
        { id: 'file_path', label: 'File Path (e.g. /assets/sfx/thunder.ogg)', type: 'textinput', default: '' },
        { id: 'label', label: 'Clip Label', type: 'textinput', default: 'SFX' },
        { id: 'volume', label: 'Volume (0–100)', type: 'number', default: 80, min: 0, max: 100 },
        { id: 'loop', label: 'Loop', type: 'checkbox', default: false },
        { id: 'spatial_x', label: 'Spatial X (0–100, left→right)', type: 'number', default: 50, min: 0, max: 100 },
        { id: 'spatial_y', label: 'Spatial Y (0–100, front→rear)', type: 'number', default: 50, min: 0, max: 100 },
      ],
      callback: ({ options }) => {
        this.socket?.emit(EVENTS.SFX_TRIGGER, {
          id: String(options['clip_id']),
          label: String(options['label']),
          filePath: String(options['file_path']),
          loop: Boolean(options['loop']),
          volume: Number(options['volume']) / 100,
          spatial: {
            x: Number(options['spatial_x']) / 100,
            y: Number(options['spatial_y']) / 100,
          },
        })
      },
    },

    sfx_stop: {
      label: 'Stop SFX',
      description: 'Stop a looping sound effect by clip ID',
      options: [{ id: 'clip_id', label: 'Clip ID', type: 'textinput', default: '' }],
      callback: ({ options }) => {
        this.socket?.emit(EVENTS.SFX_STOP, { clipId: String(options['clip_id']) })
      },
    },

    combat_next_turn: {
      label: 'Next Combat Turn',
      description: 'Advance to the next combatant in initiative order',
      options: [],
      callback: () => {
        this.socket?.emit(EVENTS.COMBAT_NEXT_TURN)
      },
    },

    preset_apply: {
      label: 'Apply Environment Preset',
      description: 'Apply an atmosphere preset by preset ID',
      options: [
        {
          id: 'preset_id',
          label: 'Preset ID',
          type: 'dropdown',
          default: ENVIRONMENT_PRESETS[0]?.id ?? '',
          choices: ENVIRONMENT_PRESETS.map((p) => ({ id: p.id, label: p.label })),
        },
      ],
      callback: ({ options }) => {
        const preset = ENVIRONMENT_PRESETS.find((p) => p.id === options['preset_id'])
        if (!preset) return
        this.socket?.emit(EVENTS.AV_PARTICLES, {
          type: preset.particles.type,
          intensity: preset.particles.intensity,
        })
        this.socket?.emit(EVENTS.AV_COLORGRADE, preset.colorGrade)
        this.socket?.emit(EVENTS.MOOD_UPDATE, { value: preset.audioMood })
        this._updateState({ moodValue: preset.audioMood })
      },
    },

    fx_overlay_play: {
      label: 'Play FX Overlay',
      description: 'Play a VP9+alpha WebM overlay on the AV display',
      options: [
        { id: 'clip_id', label: 'Clip ID', type: 'textinput', default: '' },
        { id: 'url', label: 'File URL/Path', type: 'textinput', default: '' },
        { id: 'loop_offset', label: 'Loop Offset (seconds)', type: 'number', default: 0, min: 0, max: 10 },
      ],
      callback: ({ options }) => {
        this.socket?.emit(EVENTS.AV_FX_OVERLAY, {
          clipId: String(options['clip_id']),
          url: String(options['url']),
          loopOffset: Number(options['loop_offset']),
          active: true,
        })
      },
    },

    fx_overlay_stop: {
      label: 'Stop FX Overlay',
      description: 'Stop an active FX overlay by clip ID',
      options: [{ id: 'clip_id', label: 'Clip ID', type: 'textinput', default: '' }],
      callback: ({ options }) => {
        this.socket?.emit(EVENTS.AV_FX_OVERLAY, {
          clipId: String(options['clip_id']),
          url: '',
          loopOffset: 0,
          active: false,
        })
      },
    },
  }

  // ── Feedbacks ──────────────────────────────────────────────────────────────

  /**
   * All available Companion feedbacks.
   * Each feedback drives the visual appearance of a Stream Deck button based on module state.
   */
  readonly feedbacks: Record<string, CompanionFeedback> = {

    connection_status: {
      label: 'Connection Status',
      description: 'Button turns green when connected, red when disconnected',
      options: [],
      callback: (_feedback, state) => ({
        bgcolor: state.connected ? 0x00aa00 : 0xaa0000,
        color: 0xffffff,
        text: state.connected ? 'LIVE' : 'OFF',
      }),
    },

    mood_level: {
      label: 'Mood Level',
      description: 'Button color shifts from blue (calm) to red (dramatic)',
      options: [],
      callback: (_feedback, state) => {
        const v = state.moodValue
        const r = Math.round(v * 200)
        const b = Math.round((1 - v) * 200)
        return {
          bgcolor: (r << 16) | b,
          color: 0xffffff,
          text: `${Math.round(v * 100)}%`,
        }
      },
    },

    active_combatant: {
      label: 'Active Combatant',
      description: 'Shows current combatant name and round',
      options: [],
      callback: (_feedback, state) => ({
        text: state.activeCombatantName
          ? `R${state.combatRound}\n${state.activeCombatantName}`
          : `Round ${state.combatRound}`,
        bgcolor: 0x222222,
        color: 0xffdd44,
      }),
    },
  }

  // ── Variables ──────────────────────────────────────────────────────────────

  /**
   * All Companion variables exposed by this module.
   * Reference in Companion button labels as: $(stage-manager:<name>)
   */
  readonly variables: CompanionVariable[] = [
    { name: 'connected', label: 'Connection Status (connected/disconnected)' },
    { name: 'mood_value', label: 'Current Mood Value (0.0–1.0)' },
    { name: 'mood_percent', label: 'Current Mood Percentage (0–100)' },
    { name: 'active_scene_id', label: 'Active Scene ID' },
    { name: 'combat_round', label: 'Current Combat Round' },
    { name: 'active_combatant', label: 'Active Combatant Name' },
    { name: 'app_mode', label: 'Application Mode (play/plan/headless)' },
  ]

  /**
   * Returns current values for all Companion variables as a flat string map.
   * Poll this after each state change and push to Companion's variable store.
   */
  getVariableValues(): Record<string, string> {
    return {
      connected: this.state.connected ? 'connected' : 'disconnected',
      mood_value: this.state.moodValue.toFixed(2),
      mood_percent: String(Math.round(this.state.moodValue * 100)),
      active_scene_id: this.state.activeSceneId ?? '',
      combat_round: String(this.state.combatRound),
      active_combatant: this.state.activeCombatantName ?? '',
      app_mode: this.state.appMode,
    }
  }
}

export type { CompanionConfig, CompanionAction, CompanionFeedback, CompanionVariable, ModuleState }
