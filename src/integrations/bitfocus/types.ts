/**
 * Companion module type definitions.
 * Defines the interface contract between the Stage Manager and Bitfocus Companion.
 */
import type { AppMode } from '@core/types'

export interface CompanionConfig {
  /** IP address of the machine running Stage Manager. Default: '127.0.0.1' */
  host: string
  /** TCP port of the Stage Manager Express server. Default: 3000 */
  port: number
}

export type OptionType = 'textinput' | 'number' | 'dropdown' | 'checkbox'

export interface CompanionOption {
  id: string
  label: string
  type: OptionType
  default?: string | number | boolean
  min?: number
  max?: number
  choices?: Array<{ id: string; label: string }>
}

export interface CompanionActionOptions {
  [key: string]: string | number | boolean
}

export interface CompanionAction {
  label: string
  description: string
  options: CompanionOption[]
  callback: (action: { options: CompanionActionOptions }) => void
}

export interface CompanionFeedback {
  label: string
  description: string
  options: CompanionOption[]
  callback: (feedback: { options: CompanionActionOptions }, currentState: ModuleState) => CompanionFeedbackResult
}

export interface CompanionFeedbackResult {
  /** RGB packed integer — e.g. 0x00aa00 for green */
  color?: number
  bgcolor?: number
  text?: string
}

export interface CompanionVariable {
  /** Variable identifier used in Companion button labels: $(stage-manager:<name>) */
  name: string
  label: string
}

export interface ModuleState {
  connected: boolean
  /** Current mood value — 0.0 (calm) to 1.0 (dramatic) */
  moodValue: number
  activeSceneId: string | null
  combatRound: number
  activeCombatantName: string | null
  appMode: AppMode
}
