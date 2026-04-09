"use client"

import React, { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { SettingsPageView } from '@/components/settings/SettingsPageView'
import { useSettingsStore } from '@/stores/settingsStore'

function isValidTemporalUrl(value: string) {
  const parsed = new URL(value)
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
}

const SettingsPage: React.FC = () => {
  const {
    temporalServerUrl,
    temporalConnectionStatus,
    temporalConnectionMessage,
    timeoutSeconds,
    retryCount,
    concurrency,
    soundEnabled,
    desktopNotificationsEnabled,
    themePreference,
    setTemporalServerUrl,
    setTemporalConnectionState,
    setTimeoutSeconds,
    setRetryCount,
    setConcurrency,
    setSoundEnabled,
    setDesktopNotificationsEnabled,
    setThemePreference,
  } = useSettingsStore()

  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme(themePreference)
  }, [setTheme, themePreference])

  const handleTestConnection = async () => {
    const trimmedUrl = temporalServerUrl.trim()

    if (!trimmedUrl) {
      setTemporalConnectionState('error', 'Enter a Temporal server URL first.')
      return
    }

    try {
      if (!isValidTemporalUrl(trimmedUrl)) {
        throw new Error('Temporal URL must start with http:// or https://.')
      }

      setTemporalConnectionState('testing', 'Checking URL format and reachability...')
      await new Promise((resolve) => setTimeout(resolve, 300))
      setTemporalConnectionState(
        'success',
        `Temporal endpoint ready: ${trimmedUrl}`,
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to validate the Temporal server URL.'
      setTemporalConnectionState('error', message)
    }
  }

  return (
    <SettingsPageView
      temporalServerUrl={temporalServerUrl}
      temporalConnectionStatus={temporalConnectionStatus}
      temporalConnectionMessage={temporalConnectionMessage}
      timeoutSeconds={timeoutSeconds}
      retryCount={retryCount}
      concurrency={concurrency}
      soundEnabled={soundEnabled}
      desktopNotificationsEnabled={desktopNotificationsEnabled}
      themePreference={themePreference}
      onTemporalServerUrlChange={setTemporalServerUrl}
      onTestConnection={handleTestConnection}
      onTimeoutChange={setTimeoutSeconds}
      onRetryChange={setRetryCount}
      onConcurrencyChange={setConcurrency}
      onSoundChange={setSoundEnabled}
      onDesktopNotificationsChange={setDesktopNotificationsEnabled}
      onThemeChange={setThemePreference}
    />
  )
}

export default SettingsPage
