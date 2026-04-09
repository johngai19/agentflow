import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'
export type ThemePreference = 'dark' | 'light' | 'system'

export interface SettingsState {
  temporalServerUrl: string
  temporalConnectionStatus: ConnectionStatus
  temporalConnectionMessage: string | null
  timeoutSeconds: number
  retryCount: number
  concurrency: number
  soundEnabled: boolean
  desktopNotificationsEnabled: boolean
  themePreference: ThemePreference
  setTemporalServerUrl: (url: string) => void
  setTemporalConnectionState: (status: ConnectionStatus, message?: string | null) => void
  setTimeoutSeconds: (value: number) => void
  setRetryCount: (value: number) => void
  setConcurrency: (value: number) => void
  setSoundEnabled: (enabled: boolean) => void
  setDesktopNotificationsEnabled: (enabled: boolean) => void
  setThemePreference: (theme: ThemePreference) => void
  resetSettings: () => void
}

export const SETTINGS_STORAGE_KEY = 'agentflow-settings'

type PersistedSettingsState = Pick<
  SettingsState,
  | 'temporalServerUrl'
  | 'timeoutSeconds'
  | 'retryCount'
  | 'concurrency'
  | 'soundEnabled'
  | 'desktopNotificationsEnabled'
  | 'themePreference'
>

const DEFAULT_TEMPORAL_SERVER_URL =
  process.env.NEXT_PUBLIC_TEMPORAL_UI_URL ?? 'http://localhost:8080'

export const SETTINGS_DEFAULTS = {
  temporalServerUrl: DEFAULT_TEMPORAL_SERVER_URL,
  temporalConnectionStatus: 'idle' as ConnectionStatus,
  temporalConnectionMessage: null as string | null,
  timeoutSeconds: 30,
  retryCount: 3,
  concurrency: 4,
  soundEnabled: true,
  desktopNotificationsEnabled: false,
  themePreference: 'system' as ThemePreference,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createSafeStorage() {
  return createJSONStorage<PersistedSettingsState>(() => ({
    getItem: (name: string) => {
      try {
        if (typeof localStorage === 'undefined') return null
        return localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name: string, value: string) => {
      try {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(name, value)
      } catch (error) {
        console.warn('[settingsStore] localStorage write failed', error)
      }
    },
    removeItem: (name: string) => {
      try {
        if (typeof localStorage === 'undefined') return
        localStorage.removeItem(name)
      } catch {
        // ignore storage cleanup failures
      }
    },
  }))
}

const buildInitialState = (): Omit<
  SettingsState,
  | 'setTemporalServerUrl'
  | 'setTemporalConnectionState'
  | 'setTimeoutSeconds'
  | 'setRetryCount'
  | 'setConcurrency'
  | 'setSoundEnabled'
  | 'setDesktopNotificationsEnabled'
  | 'setThemePreference'
  | 'resetSettings'
> => ({
  ...SETTINGS_DEFAULTS,
})

export function createSettingsStoreConfig(storage?: StateStorage) {
  return persist<SettingsState, [], [], PersistedSettingsState>(
    (set) => ({
      ...buildInitialState(),
      setTemporalServerUrl: (url) =>
        set({
          temporalServerUrl: url,
          temporalConnectionStatus: 'idle',
          temporalConnectionMessage: null,
        }),
      setTemporalConnectionState: (status, message = null) =>
        set({
          temporalConnectionStatus: status,
          temporalConnectionMessage: message,
        }),
      setTimeoutSeconds: (value) =>
        set({
          timeoutSeconds: clamp(value, 5, 600),
        }),
      setRetryCount: (value) =>
        set({
          retryCount: clamp(value, 0, 10),
        }),
      setConcurrency: (value) =>
        set({
          concurrency: clamp(value, 1, 20),
        }),
      setSoundEnabled: (enabled) =>
        set({
          soundEnabled: enabled,
        }),
      setDesktopNotificationsEnabled: (enabled) =>
        set({
          desktopNotificationsEnabled: enabled,
        }),
      setThemePreference: (theme) =>
        set({
          themePreference: theme,
        }),
      resetSettings: () =>
        set({
          ...buildInitialState(),
        }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: storage ? createJSONStorage(() => storage) : createSafeStorage(),
      partialize: (state): PersistedSettingsState => ({
        temporalServerUrl: state.temporalServerUrl,
        timeoutSeconds: state.timeoutSeconds,
        retryCount: state.retryCount,
        concurrency: state.concurrency,
        soundEnabled: state.soundEnabled,
        desktopNotificationsEnabled: state.desktopNotificationsEnabled,
        themePreference: state.themePreference,
      }),
    },
  )
}

export const useSettingsStore = create<SettingsState>()(createSettingsStoreConfig())
