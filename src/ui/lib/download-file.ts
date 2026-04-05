/**
 * Triggers a browser file download from a Blob object.
 * Used for settings export, scene summary markdown, and AV media captures.
 */
export function downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
