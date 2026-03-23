/**
 * Items store tests — Sprint 15 code review.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useItemsStore } from './items-store'
import type { Item } from '@core/types'

function makeItem(overrides?: Partial<Item>): Item {
    return {
        id: overrides?.id ?? 'item-1',
        campaignId: overrides?.campaignId ?? 'campaign-1',
        name: overrides?.name ?? 'Test Item',
        description: overrides?.description ?? '',
        rarity: overrides?.rarity ?? null,
        category: overrides?.category ?? null,
        properties: overrides?.properties ?? [],
        tags: overrides?.tags ?? [],
        sourceNoteId: overrides?.sourceNoteId ?? null,
        createdAt: overrides?.createdAt ?? '2026-01-01T00:00:00Z',
        updatedAt: overrides?.updatedAt ?? '2026-01-01T00:00:00Z',
    }
}

beforeEach(() => {
    useItemsStore.setState({
        items: [],
        activeItemId: null,
        isLoading: false,
    })
})

describe('items-store', () => {
    it('setItems replaces the items array', () => {
        const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })]
        useItemsStore.getState().setItems(items)
        expect(useItemsStore.getState().items).toHaveLength(2)
        expect(useItemsStore.getState().items[0]!.id).toBe('a')
    })

    it('addItem appends to the items array', () => {
        useItemsStore.getState().setItems([makeItem({ id: 'a' })])
        useItemsStore.getState().addItem(makeItem({ id: 'b' }))
        expect(useItemsStore.getState().items).toHaveLength(2)
    })

    it('updateItem patches only the matching item', () => {
        useItemsStore.getState().setItems([
            makeItem({ id: 'a', name: 'Original' }),
            makeItem({ id: 'b', name: 'Other' }),
        ])
        useItemsStore.getState().updateItem('a', { name: 'Updated' })
        const items = useItemsStore.getState().items
        expect(items.find((i) => i.id === 'a')!.name).toBe('Updated')
        expect(items.find((i) => i.id === 'b')!.name).toBe('Other')
    })

    it('removeItem removes the item and clears activeItemId if it matches', () => {
        useItemsStore.getState().setItems([makeItem({ id: 'a' }), makeItem({ id: 'b' })])
        useItemsStore.getState().setActiveItemId('a')
        useItemsStore.getState().removeItem('a')

        expect(useItemsStore.getState().items).toHaveLength(1)
        expect(useItemsStore.getState().items[0]!.id).toBe('b')
        expect(useItemsStore.getState().activeItemId).toBeNull()
    })

    it('removeItem does not clear activeItemId if different item removed', () => {
        useItemsStore.getState().setItems([makeItem({ id: 'a' }), makeItem({ id: 'b' })])
        useItemsStore.getState().setActiveItemId('a')
        useItemsStore.getState().removeItem('b')

        expect(useItemsStore.getState().activeItemId).toBe('a')
    })

    it('setActiveItemId updates the active item', () => {
        useItemsStore.getState().setActiveItemId('item-42')
        expect(useItemsStore.getState().activeItemId).toBe('item-42')

        useItemsStore.getState().setActiveItemId(null)
        expect(useItemsStore.getState().activeItemId).toBeNull()
    })
})
