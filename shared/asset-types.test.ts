/**
 * Asset types contract tests.
 * Validates shared type interfaces and constants.
 */
import { describe, it, expect } from 'vitest'
import type { MediaAsset, MediaType, PlaybackMode, AssetCategory, AssetFilter, CreateAssetInput, UpdateAssetInput } from './asset-types'

describe('Asset types — type contracts', () => {
    it('MediaAsset has all required fields', () => {
        const asset: MediaAsset = {
            id: 'test-id',
            filePath: '/path/to/file.png',
            fileName: 'file.png',
            mediaType: 'image',
            fileSize: 1024,
            width: 1920,
            height: 1080,
            duration: null,
            categories: ['background'],
            tags: ['forest', 'night'],
            playbackMode: 'loop',
            thumbnail: null,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
        }
        expect(asset.id).toBe('test-id')
        expect(asset.mediaType).toBe('image')
        expect(asset.categories).toContain('background')
    })

    it('MediaType covers image, video, audio', () => {
        const types: MediaType[] = ['image', 'video', 'audio']
        expect(types).toHaveLength(3)
    })

    it('PlaybackMode covers loop, once, freeze', () => {
        const modes: PlaybackMode[] = ['loop', 'once', 'freeze']
        expect(modes).toHaveLength(3)
    })

    it('AssetCategory covers background, gameboard, character, item', () => {
        const categories: AssetCategory[] = ['background', 'gameboard', 'character', 'item']
        expect(categories).toHaveLength(4)
    })

    it('AssetFilter has optional filter fields', () => {
        const empty: AssetFilter = {}
        expect(empty.mediaType).toBeUndefined()

        const filtered: AssetFilter = {
            mediaType: 'video',
            category: 'background',
            campaignId: 'camp-1',
            search: 'forest',
        }
        expect(filtered.mediaType).toBe('video')
        expect(filtered.category).toBe('background')
    })

    it('CreateAssetInput requires filePath, fileName, mediaType', () => {
        const input: CreateAssetInput = {
            filePath: '/path/to/video.mp4',
            fileName: 'video.mp4',
            mediaType: 'video',
            fileSize: 50000,
        }
        expect(input.filePath).toBe('/path/to/video.mp4')
        expect(input.categories).toBeUndefined() // optional
    })

    it('UpdateAssetInput has all fields optional', () => {
        const input: UpdateAssetInput = {}
        expect(input.fileName).toBeUndefined()

        const partial: UpdateAssetInput = {
            fileName: 'renamed.png',
            categories: ['gameboard'],
            playbackMode: 'freeze',
        }
        expect(partial.fileName).toBe('renamed.png')
    })

    it('MediaAsset supports nullable fields', () => {
        const asset: MediaAsset = {
            id: 'a-1',
            filePath: '/audio.mp3',
            fileName: 'audio.mp3',
            mediaType: 'audio',
            fileSize: 2048,
            width: null,
            height: null,
            duration: 120.5,
            categories: [],
            tags: [],
            playbackMode: 'once',
            thumbnail: null,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
        }
        expect(asset.width).toBeNull()
        expect(asset.height).toBeNull()
        expect(asset.duration).toBe(120.5)
    })
})
