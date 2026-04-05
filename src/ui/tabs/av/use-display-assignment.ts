/**
 * useDisplayAssignment — shared display role assignment logic.
 * Used by both AVToolbar (compact) and DisplayAssignmentPanel (full settings view).
 */
import { useOutputStore } from '../../stores/output-store'
import { emitOutputEnable, emitOutputDisable } from '../../lib/sync'
import type { OutputRole } from '../../stores/output-store'

export function useDisplayAssignment() {
    const { outputs, enableOutput, disableOutput } = useOutputStore()

    function getRoleForDisplay(displayId: number): OutputRole | null {
        if (outputs.BG?.displayId === displayId) return 'BG'
        if (outputs.GB?.displayId === displayId) return 'GB'
        return null
    }

    function handleRoleChange(displayId: number, newRole: string): void {
        const currentRole = getRoleForDisplay(displayId)
        if (newRole === 'disabled') {
            if (currentRole) { disableOutput(currentRole); emitOutputDisable(currentRole) }
            return
        }
        const role = newRole as OutputRole
        if (outputs[role] && outputs[role]!.displayId !== displayId) {
            disableOutput(role); emitOutputDisable(role)
        }
        if (currentRole && currentRole !== role) {
            disableOutput(currentRole); emitOutputDisable(currentRole)
        }
        enableOutput(displayId, role)
        emitOutputEnable(displayId, role)
    }

    function handlePopOut(role: OutputRole): void {
        if (outputs[role]) { disableOutput(role); emitOutputDisable(role) }
        enableOutput('windowed', role)
        emitOutputEnable('windowed', role)
    }

    function togglePopOut(role: OutputRole): void {
        if (outputs[role]?.displayId === 'windowed') {
            disableOutput(role); emitOutputDisable(role)
        } else {
            handlePopOut(role)
        }
    }

    function isWindowed(role: OutputRole): boolean {
        return outputs[role]?.displayId === 'windowed'
    }

    return { outputs, getRoleForDisplay, handleRoleChange, handlePopOut, togglePopOut, isWindowed }
}
