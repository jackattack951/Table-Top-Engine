import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Item } from '@core/types'

interface ItemsState {
    items: Item[]
    activeItemId: string | null
    isLoading: boolean

    setItems: (items: Item[]) => void
    addItem: (item: Item) => void
    updateItem: (id: string, patch: Partial<Item>) => void
    removeItem: (id: string) => void
    setActiveItemId: (id: string | null) => void
    setLoading: (loading: boolean) => void
}

export const useItemsStore = create<ItemsState>()(
    subscribeWithSelector((set) => ({
        items: [],
        activeItemId: null,
        isLoading: false,

        setItems: (items) => set({ items }),
        addItem: (item) => set((s) => ({ items: [...s.items, item] })),
        updateItem: (id, patch) => set((s) => ({
            items: s.items.map((i) => i.id === id ? { ...i, ...patch } : i),
        })),
        removeItem: (id) => set((s) => ({
            items: s.items.filter((i) => i.id !== id),
            activeItemId: s.activeItemId === id ? null : s.activeItemId,
        })),
        setActiveItemId: (id) => set({ activeItemId: id }),
        setLoading: (loading) => set({ isLoading: loading }),
    }))
)
