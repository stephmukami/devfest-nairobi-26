import { useEffect, useState } from 'react'
import { api } from './lib/api'
import { useRoute } from './lib/route'
import { load, save } from './lib/storage'
import type { AppConfig } from './lib/types'
import { CustomerApp } from './pages/CustomerApp'
import { StagePage } from './pages/StagePage'

const USER_KEY = 'shippy.user'

export default function App() {
  const route = useRoute()
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState(() => load(USER_KEY, 'u_amani'))

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setError(String(e)))
  }, [])

  // Keep the stage window and the customer window on the same persona.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_KEY && e.newValue) setUserId(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const changeUser = (id: string) => {
    save(USER_KEY, id)
    setUserId(id)
  }

  if (error) return <p className="p-8 text-destructive">Could not reach the Shippy API: {error}</p>
  if (!config) return <p className="p-8 text-muted-foreground">Loading…</p>

  const validUser = config.personas.some((p) => p.user_id === userId) ? userId : config.personas[0].user_id

  return route.name === 'stage' ? (
    <StagePage config={config} userId={validUser} onUserChange={changeUser} />
  ) : (
    <CustomerApp route={route} config={config} userId={validUser} onUserChange={changeUser} />
  )
}
