import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { AppMode, NetworkMode } from '@core/types'

interface AppState {
    appMode: AppMode | null
    networkMode: NetworkMode
    isConnected: boolean
    hasLaunched: boolean
    activeCampaignId: string | null
    activeCampaignName: string | null
    setAppMode: (mode: AppMode) => void
    setNetworkMode: (mode: NetworkMode) => void
    setConnected: (connected: boolean) => void
    setLaunched: () => void
    setActiveCampaign: (id: string, name: string) => void
    clearActiveCampaign: () => void
}

export const useAppStore = create<AppState>()(
    subscribeWithSelector((set) => ({
        appMode: null,
        networkMode: 'local',
        isConnected: false,
        hasLaunched: false,
        activeCampaignId: null,
        activeCampaignName: null,
        setAppMode: (appMode) => set({ appMode }),
        setNetworkMode: (networkMode) => set({ networkMode }),
        setConnected: (isConnected) => set({ isConnected }),
        setLaunched: () => set({ hasLaunched: true }),
        setActiveCampaign: (activeCampaignId, activeCampaignName) =>
            set({ activeCampaignId, activeCampaignName }),
        clearActiveCampaign: () =>
            set({ activeCampaignId: null, activeCampaignName: null }),
    }))
)
