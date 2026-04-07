"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure Agent Town dashboard preferences
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Coming soon - agent configuration, notification preferences, and API keys</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Settings page is a placeholder for future configuration options including:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
            <li>Agent polling interval</li>
            <li>GitHub API integration tokens</li>
            <li>Notification preferences</li>
            <li>Dashboard theme and layout</li>
            <li>Project repository connections</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
