import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import type { StateStorage } from 'zustand/middleware'
import { SettingsPageView } from '@/components/settings/SettingsPageView'
import {
  createSettingsStoreConfig,
  SETTINGS_DEFAULTS,
  SETTINGS_STORAGE_KEY,
  type SettingsState,
} from '@/stores/settingsStore'

function createMemoryStorage(initial: Record<string, string> = {}): StateStorage {
  const data = new Map(Object.entries(initial))

  return {
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => {
      data.set(name, value)
    },
    removeItem: (name) => {
      data.delete(name)
    },
  }
}

function makeStore(storage?: StateStorage) {
  return createStore<SettingsState>()(createSettingsStoreConfig(storage))
}

function renderView(overrides: Partial<ComponentProps<typeof SettingsPageView>> = {}) {
  return renderToStaticMarkup(
    createElement(SettingsPageView, {
      temporalServerUrl: 'http://localhost:8080',
      temporalConnectionStatus: 'idle',
      temporalConnectionMessage: null,
      timeoutSeconds: 30,
      retryCount: 3,
      concurrency: 4,
      soundEnabled: true,
      desktopNotificationsEnabled: false,
      themePreference: 'system',
      onTemporalServerUrlChange: () => {},
      onTestConnection: () => {},
      onTimeoutChange: () => {},
      onRetryChange: () => {},
      onConcurrencyChange: () => {},
      onSoundChange: () => {},
      onDesktopNotificationsChange: () => {},
      onThemeChange: () => {},
      ...overrides,
    }),
  )
}

describe('settingsStore', () => {
  it('uses the expected defaults', () => {
    const store = makeStore()
    expect(store.getState().temporalServerUrl).toBe(SETTINGS_DEFAULTS.temporalServerUrl)
    expect(store.getState().timeoutSeconds).toBe(30)
    expect(store.getState().retryCount).toBe(3)
    expect(store.getState().concurrency).toBe(4)
    expect(store.getState().soundEnabled).toBe(true)
    expect(store.getState().desktopNotificationsEnabled).toBe(false)
    expect(store.getState().themePreference).toBe('system')
  })

  it('updates the Temporal URL and clears prior test status', () => {
    const store = makeStore()
    store.getState().setTemporalConnectionState('success', 'Connected')
    store.getState().setTemporalServerUrl('https://temporal.internal')

    expect(store.getState().temporalServerUrl).toBe('https://temporal.internal')
    expect(store.getState().temporalConnectionStatus).toBe('idle')
    expect(store.getState().temporalConnectionMessage).toBeNull()
  })

  it('clamps timeout between 5 and 600 seconds', () => {
    const store = makeStore()
    store.getState().setTimeoutSeconds(1)
    expect(store.getState().timeoutSeconds).toBe(5)

    store.getState().setTimeoutSeconds(900)
    expect(store.getState().timeoutSeconds).toBe(600)
  })

  it('clamps retry count between 0 and 10', () => {
    const store = makeStore()
    store.getState().setRetryCount(-2)
    expect(store.getState().retryCount).toBe(0)

    store.getState().setRetryCount(99)
    expect(store.getState().retryCount).toBe(10)
  })

  it('clamps concurrency between 1 and 20', () => {
    const store = makeStore()
    store.getState().setConcurrency(0)
    expect(store.getState().concurrency).toBe(1)

    store.getState().setConcurrency(200)
    expect(store.getState().concurrency).toBe(20)
  })

  it('updates notification preferences', () => {
    const store = makeStore()
    store.getState().setSoundEnabled(false)
    store.getState().setDesktopNotificationsEnabled(true)

    expect(store.getState().soundEnabled).toBe(false)
    expect(store.getState().desktopNotificationsEnabled).toBe(true)
  })

  it('updates the theme preference', () => {
    const store = makeStore()
    store.getState().setThemePreference('dark')
    expect(store.getState().themePreference).toBe('dark')
  })

  it('persists only stable settings fields', () => {
    const storage = createMemoryStorage()
    const store = makeStore(storage)

    store.getState().setTemporalServerUrl('https://temporal.example.com')
    store.getState().setTemporalConnectionState('error', 'bad url')
    store.getState().setThemePreference('light')

    const raw = storage.getItem(SETTINGS_STORAGE_KEY)
    expect(raw).not.toBeNull()

    const payload = JSON.parse(raw as string)
    expect(payload.state.temporalServerUrl).toBe('https://temporal.example.com')
    expect(payload.state.themePreference).toBe('light')
    expect(payload.state.temporalConnectionStatus).toBeUndefined()
    expect(payload.state.temporalConnectionMessage).toBeUndefined()
  })

  it('hydrates persisted settings from storage', () => {
    const storage = createMemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        state: {
          temporalServerUrl: 'https://persisted.temporal',
          timeoutSeconds: 90,
          retryCount: 6,
          concurrency: 12,
          soundEnabled: false,
          desktopNotificationsEnabled: true,
          themePreference: 'dark',
        },
        version: 0,
      }),
    })

    const store = makeStore(storage)

    expect(store.getState().temporalServerUrl).toBe('https://persisted.temporal')
    expect(store.getState().timeoutSeconds).toBe(90)
    expect(store.getState().retryCount).toBe(6)
    expect(store.getState().concurrency).toBe(12)
    expect(store.getState().soundEnabled).toBe(false)
    expect(store.getState().desktopNotificationsEnabled).toBe(true)
    expect(store.getState().themePreference).toBe('dark')
  })

  it('resetSettings restores defaults and clears transient state', () => {
    const store = makeStore()
    store.getState().setTemporalServerUrl('https://custom.temporal')
    store.getState().setTemporalConnectionState('error', 'failed')
    store.getState().setRetryCount(9)
    store.getState().setSoundEnabled(false)
    store.getState().setThemePreference('light')

    store.getState().resetSettings()

    expect(store.getState().temporalServerUrl).toBe(SETTINGS_DEFAULTS.temporalServerUrl)
    expect(store.getState().temporalConnectionStatus).toBe('idle')
    expect(store.getState().temporalConnectionMessage).toBeNull()
    expect(store.getState().retryCount).toBe(SETTINGS_DEFAULTS.retryCount)
    expect(store.getState().soundEnabled).toBe(true)
    expect(store.getState().themePreference).toBe('system')
  })
})

describe('SettingsPageView', () => {
  it('renders all four settings sections', () => {
    const html = renderView()
    expect(html).toContain('Temporal Server Connection')
    expect(html).toContain('Agent Defaults')
    expect(html).toContain('Notification Preferences')
    expect(html).toContain('Theme Toggle')
  })

  it('renders the expected controls and labels', () => {
    const html = renderView()
    expect(html).toContain('Temporal server URL')
    expect(html).toContain('Test connection')
    expect(html).toContain('Timeout (seconds)')
    expect(html).toContain('Retry count')
    expect(html).toContain('Concurrency')
    expect(html).toContain('Sound alerts')
    expect(html).toContain('Desktop notifications')
  })

  it('marks the selected theme option as pressed', () => {
    const html = renderView({ themePreference: 'dark' })
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Dark')
  })
})
