import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AlertsState } from '@/lib/fcm'
import { Icon } from '@/lib/icons'

interface Props {
  personaName: string
  alerts: AlertsState
  onEnable: () => Promise<void>
  onDisable: () => Promise<void>
}

/** Why the switch is where it is, or why it cannot be used. */
const NOTE: Record<AlertsState, string> = {
  granted: 'This device gets a notification for urgent updates, even when Shippy is closed.',
  off: 'Alerts are off on this device. You will still see updates while Shippy is open.',
  default: 'Turn on to get urgent updates even when Shippy is closed.',
  denied: 'Notifications are blocked for this site. Allow them in your browser or phone settings, then reload Shippy.',
  error: 'Could not reach the notification service. Try again.',
  unsupported: 'This browser cannot receive push notifications.',
  not_configured: 'Push notifications are not set up for this deployment.',
  ios_install: 'On iPhone, open Shippy in Safari, tap Share → Add to Home Screen, then open Shippy from the icon.',
}

const CAN_TOGGLE = new Set<AlertsState>(['granted', 'off', 'default', 'error'])

export function SettingsSheet({ personaName, alerts, onEnable, onDisable }: Props) {
  const [busy, setBusy] = useState(false)
  const on = alerts === 'granted'

  async function toggle(next: boolean) {
    setBusy(true)
    try {
      await (next ? onEnable() : onDisable())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Icon name="settings" size={20} />
        </Button>
      </DialogTrigger>
      {/* A right-hand sidebar: the shared dialog, pinned to the edge instead of centred. */}
      <DialogContent
        className="top-0 right-0 left-auto flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col content-start gap-6 rounded-none p-6 sm:max-w-sm data-open:slide-in-from-right data-open:zoom-in-100 data-closed:slide-out-to-right data-closed:zoom-out-100"
      >
        <DialogTitle className="text-lg font-semibold">Settings</DialogTitle>

        <section className="grid gap-3">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Notifications</h3>
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
            <Icon name={on ? 'bell' : 'bellOff'} size={20} className={on ? 'mt-0.5 text-primary' : 'mt-0.5 text-muted-foreground'} />
            <div className="grid flex-1 gap-1">
              <Label htmlFor="settings-alerts" className="font-medium">
                Alerts on this device
              </Label>
              <DialogDescription className="text-xs">{NOTE[alerts]}</DialogDescription>
              {on && <p className="text-xs text-muted-foreground">Alerts here are for {personaName}.</p>}
            </div>
            <Switch
              id="settings-alerts"
              checked={on}
              disabled={busy || !CAN_TOGGLE.has(alerts)}
              onCheckedChange={(v) => void toggle(v)}
            />
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}
