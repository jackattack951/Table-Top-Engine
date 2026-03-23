/**
 * Entity extractor tests — Sprint 15i.
 */
import { describe, it, expect } from 'vitest'
import { extractEntityFromText } from './entity-extractor'

describe('extractEntityFromText', () => {
    it('extracts title from bold text', () => {
        const text = '**Mira Ashveil** is a brilliant human artificer.'
        const result = extractEntityFromText(text, 'npc')
        expect(result.title).toBe('Mira Ashveil')
    })

    it('extracts title from heading', () => {
        const text = '## The Dragon\'s Lair\n\nA vast cavern filled with gold.'
        const result = extractEntityFromText(text, 'location')
        expect(result.title).toBe("The Dragon's Lair")
    })

    it('extracts title from NPC pattern', () => {
        const text = 'NPC — Captain Renn\nRace: Human\nClass: Fighter'
        const result = extractEntityFromText(text, 'npc')
        expect(result.title).toBe('Captain Renn')
    })

    it('falls back to first line for title', () => {
        const text = 'A mysterious figure in the shadows.\nThey wear a dark cloak.'
        const result = extractEntityFromText(text, 'npc')
        expect(result.title).toBe('A mysterious figure in the shadows.')
    })

    it('parses NPC metadata fields', () => {
        const text = 'Race: Half-Elf\nClass: Ranger\nAlignment: Chaotic Good\nA wandering ranger.'
        const result = extractEntityFromText(text, 'npc')
        expect(result.race).toBe('Half-Elf')
        expect(result.class).toBe('Ranger')
        expect(result.alignment).toBe('Chaotic Good')
    })

    it('does not parse NPC fields for non-NPC type', () => {
        const text = 'Race: Elf\nClass: Wizard'
        const result = extractEntityFromText(text, 'location')
        expect(result.race).toBeNull()
        expect(result.class).toBeNull()
    })

    it('detects item rarity', () => {
        const text = 'A rare magical sword that glows with blue light.'
        const result = extractEntityFromText(text, 'item')
        expect(result.rarity).toBe('rare')
    })

    it('detects very-rare rarity', () => {
        const text = 'This is a very rare amulet of protection.'
        const result = extractEntityFromText(text, 'item')
        expect(result.rarity).toBe('very-rare')
    })

    it('detects item properties', () => {
        const text = 'A cursed sword that requires attunement. It has the finesse property.'
        const result = extractEntityFromText(text, 'item')
        expect(result.properties).toContain('cursed')
        expect(result.properties).toContain('attunement')
        expect(result.properties).toContain('finesse')
    })

    it('returns full text as body', () => {
        const text = 'Some content here.\nMore content.'
        const result = extractEntityFromText(text, 'general')
        expect(result.body).toBe(text)
    })

    it('handles empty text', () => {
        const result = extractEntityFromText('', 'general')
        expect(result.title).toBe('')
        expect(result.body).toBe('')
    })

    it('detects rarity case-insensitively', () => {
        const result = extractEntityFromText('A LEGENDARY sword of power.', 'item')
        expect(result.rarity).toBe('legendary')
    })

    it('detects rarity with mixed case', () => {
        const result = extractEntityFromText('This is a Very Rare amulet.', 'item')
        expect(result.rarity).toBe('very-rare')
    })

    it('picks highest rarity when multiple keywords present', () => {
        // RARITY_PATTERNS is ordered by priority: artifact > legendary > very-rare > rare > uncommon > common
        const result = extractEntityFromText('A rare and legendary blade.', 'item')
        // "legendary" appears before "rare" in the pattern list, so it wins
        expect(result.rarity).toBe('legendary')
    })

    it('returns null rarity for non-item types', () => {
        const result = extractEntityFromText('A rare elf wizard.', 'npc')
        expect(result.rarity).toBeNull()
    })

    it('returns empty properties for non-item types', () => {
        const result = extractEntityFromText('cursed with attunement issues', 'location')
        expect(result.properties).toEqual([])
    })

    it('handles text with only whitespace', () => {
        const result = extractEntityFromText('   \n  \n  ', 'general')
        expect(result.title).toBe('')
        expect(result.body).toBe('')
    })

    it('extracts title from deeply nested heading', () => {
        const result = extractEntityFromText('#### Deep Heading\n\nSome content.', 'location')
        expect(result.title).toBe('Deep Heading')
    })
})
