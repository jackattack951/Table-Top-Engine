/**
 * OUTPUT_CONFIG — single source of truth for AV Display resolution.
 * Never hardcode pixel dimensions anywhere in the codebase.
 * To unlock 4K post-launch, bump width/height here only.
 */
export const OUTPUT_CONFIG = {
    width: 1920,
    height: 1080,
    // Future: bump to 3840x2160 for 4K unlock (premium feature)
} as const
