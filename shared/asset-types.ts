/**
 * Shared types for the Media Library (asset management).
 * Used by main process (DB), API server, and cockpit/companion UI.
 */

export type MediaType = 'image' | 'video' | 'audio'
export type PlaybackMode = 'loop' | 'once' | 'freeze'
export type AssetCategory = 'background' | 'gameboard' | 'character' | 'item'

export interface MediaAsset {
    id: string
    filePath: string
    fileName: string
    mediaType: MediaType
    fileSize: number
    width: number | null
    height: number | null
    duration: number | null
    categories: AssetCategory[]
    tags: string[]
    playbackMode: PlaybackMode
    thumbnail: string | null
    createdAt: string
    updatedAt: string
}

/** Filter criteria for querying assets. */
export interface AssetFilter {
    mediaType?: MediaType
    category?: AssetCategory
    campaignId?: string
    search?: string
}

/** Payload for creating a new asset record. */
export interface CreateAssetInput {
    filePath: string
    fileName: string
    mediaType: MediaType
    fileSize: number
    width?: number | null
    height?: number | null
    duration?: number | null
    categories?: AssetCategory[]
    tags?: string[]
    playbackMode?: PlaybackMode
    thumbnail?: string | null
}

/** Payload for updating an existing asset record. */
export interface UpdateAssetInput {
    fileName?: string
    categories?: AssetCategory[]
    tags?: string[]
    playbackMode?: PlaybackMode
    thumbnail?: string | null
}
