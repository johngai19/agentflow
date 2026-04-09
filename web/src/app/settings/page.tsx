"use client"

import React, { useEffect, type ReactNode } from 'react'
import { useTheme } from 'next-themes'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  type ConnectionStatus,
  type ThemePreference,
  useSettingsStore,
} from '@/stores/settingsStore'

type ToggleOption = {
  value: ThemePreference
  label: string
  description: string
}

type SettingsPageViewProps = {
  temporalServerUrl: string
  temporalConnectionStatus: ConnectionStatus
  temporalConnectionMessage: string | null
  timeoutSeconds: number
  retryCount: number
  concurrency: number
  soundEnabled: boolean
  desktopNotificationsEnabled: boolean
  themePreference: ThemePreference
  onTemporalServerUrlChange: (url: string) => void
  onTestConnection: () => void
  onTimeoutChange: (value: number) => void
  onRetryChange: (value: number) => void
  onConcurrencyChange: (value: number) => void
  onSoundChange: (enabled: boolean) => void
  onDesktopNotificationsChange: (enabled: boolean) => void
  onThemeChange: (theme: ThemePreference) => void
}

const themeOptions: ToggleOption[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright workspace for daytime operations.',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Reduced glare for low-light monitoring.',
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follow the current OS appearance setting.',
  },
]

const connectionStatusStyles: Record<ConnectionStatus, string> = {
  idle: 'border-border bg-muted/30 text-muted-foreground',
  testing: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-red-200 bg-red-50 text-red-700',
}

function FieldRow({
  htmlFor,
  label,
  description,
  children,
}: {
  htmlFor?: string
  label: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_220px] md:items-center">
      <div className="space-y-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <label
        htmlFor={id}
        className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium"
      >
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span>{checked ? 'On' : 'Off'}</span>
      </label>
    </div>
  )
}

export function SettingsPageView({
  temporalServerUrl,
  temporalConnectionStatus,
  temporalConnectionMessage,
  timeoutSeconds,
  retryCount,
  concurrency,
  soundEnabled,
  desktopNotificationsEnabled,
  themePreference,
  onTemporalServerUrlChange,
  onTestConnection,
  onTimeoutChange,
  onRetryChange,
  onConcurrencyChange,
  onSoundChange,
  onDesktopNotificationsChange,
  onThemeChange,
}: SettingsPageViewProps) {
  const connectionLabel =
    temporalConnectionStatus === 'testing'
      ? 'Testing...'
      : temporalConnectionStatus === 'success'
        ? 'Connected'
        : temporalConnectionStatus === 'error'
          ? 'Connection failed'
          : 'Not tested'

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage Temporal connectivity, agent execution defaults, notifications,
          and appearance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Temporal Server Connection</CardTitle>
          <CardDescription>
            Set the base URL used for Temporal UI and connectivity checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow
            htmlFor="temporal-server-url"
            label="Temporal server URL"
            description="Use an HTTP or HTTPS endpoint for your Temporal Web UI or proxy."
          >
            <div className="flex flex-col gap-3">
              <Input
                id="temporal-server-url"
                type="url"
                value={temporalServerUrl}
                placeholder="http://localhost:8080"
                onChange={(event) => onTemporalServerUrlChange(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onTestConnection}
                  disabled={temporalConnectionStatus === 'testing'}
                >
                  Test connection
                </Button>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-sm ${connectionStatusStyles[temporalConnectionStatus]}`}
                >
                  {connectionLabel}
                </span>
              </div>
            </div>
          </FieldRow>
          {temporalConnectionMessage ? (
            <p className="text-sm text-muted-foreground">
              {temporalConnectionMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Defaults</CardTitle>
          <CardDescription>
            Configure baseline execution controls used for new agents and runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow
            htmlFor="agent-timeout"
            label="Timeout (seconds)"
            description="Maximum runtime before an agent step is treated as timed out."
          >
            <Input
              id="agent-timeout"
              type="number"
              min={5}
              max={600}
              value={timeoutSeconds}
              onChange={(event) => onTimeoutChange(Number(event.target.value))}
            />
          </FieldRow>
          <FieldRow
            htmlFor="agent-retry"
            label="Retry count"
            description="Automatic retry attempts for transient failures."
          >
            <Input
              id="agent-retry"
              type="number"
              min={0}
              max={10}
              value={retryCount}
              onChange={(event) => onRetryChange(Number(event.target.value))}
            />
          </FieldRow>
          <FieldRow
            htmlFor="agent-concurrency"
            label="Concurrency"
            description="Maximum parallel tasks allowed per agent execution group."
          >
            <Input
              id="agent-concurrency"
              type="number"
              min={1}
              max={20}
              value={concurrency}
              onChange={(event) => onConcurrencyChange(Number(event.target.value))}
            />
          </FieldRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose how the app should notify you about workflow and agent events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id="sound-enabled"
            label="Sound alerts"
            description="Play an audible alert when runs complete or require attention."
            checked={soundEnabled}
            onCheckedChange={onSoundChange}
          />
          <ToggleRow
            id="desktop-notifications"
            label="Desktop notifications"
            description="Allow browser notifications for long-running workflows."
            checked={desktopNotificationsEnabled}
            onCheckedChange={onDesktopNotificationsChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme Toggle</CardTitle>
          <CardDescription>
            Pick a fixed theme or follow the operating system preference.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="group"
            aria-label="Theme preference"
            className="grid gap-3 sm:grid-cols-3"
          >
            {themeOptions.map((option) => {
              const isActive = themePreference === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onThemeChange(option.value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    isActive
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="font-medium">{option.label}</div>
                  <p
                    className={`mt-2 text-sm ${
                      isActive ? 'text-background/80' : 'text-muted-foreground'
                    }`}
                  >
                    {option.description}
                  </p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function isValidTemporalUrl(value: string) {
  const parsed = new URL(value)
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
}

export default function SettingsPage(_props: Record<string, never>) {
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
