// Mirrors backend/app/models.py

export type Priority = 'info' | 'action' | 'critical'
export type View = 'home' | 'orders_list' | 'parcel_detail' | 'payment'
export type Action = 'inline' | 'toast' | 'push' | 'inbox_only'
export type IconName =
  | 'package' | 'store' | 'warehouse' | 'truck' | 'rider' | 'clock'
  | 'location' | 'alert' | 'delivered' | 'payment' | 'cancel' | 'bell'

export interface ShippyEvent {
  event_id: string
  type: string
  occurred_at: string
  user_id: string
  priority: Priority
  payload: Record<string, unknown>
}

export interface Context {
  view: View
  parcel_id: string | null
  visible: boolean
  locale: string
  local_hour: number | null
  recent_actions: string[]
}

export interface SessionState {
  connection_count: number
  visible: boolean
  view: View | null
  parcel_id: string | null
  last_seen: string | null
}

export interface Decision {
  action: Action
  sticky: boolean
  also_inbox: boolean
  urgency: 'normal' | 'high'
  also_push: boolean
  reason: string
}

export interface Message {
  title: string
  body: string
  icon: IconName
  source: 'gemini' | 'template' | 'cache'
  latency_ms: number | null
  fallback_reason: string | null
}

export interface ChannelResult {
  channel: 'sse' | 'fcm' | 'inbox' | 'inline'
  status: string
  detail: string | null
}

export interface InboxItem {
  event_id: string
  title: string
  body: string
  priority: Priority
  icon: IconName
  parcel_id: string | null
  created_at: string
  read: boolean
}

export interface TimelineEntry {
  event_id: string
  type: string
  label: string
  at: string
}

export interface Parcel {
  parcel_id: string
  user_id: string
  store: string
  item: string
  status: string
  eta_minutes: number | null
  rider_first_name: string | null
  fee_kes: number | null
  timeline: TimelineEntry[]
}

export interface Delivery {
  id: string
  kind: 'single' | 'digest'
  user_id: string
  priority: Priority
  events: ShippyEvent[]
  session: SessionState
  context: Context
  decision: Decision
  message: Message | null
  channels: ChannelResult[]
  parcels: Parcel[]
  inbox_item: InboxItem | null
  created_at: string
}

export interface Presence {
  session: SessionState
  observers: number
  clients: {
    client_id: string
    connected: boolean
    visible: boolean
    view: View
    parcel_id: string | null
    updated_at: string
  }[]
}

export interface Persona {
  user_id: string
  name: string
  locale: string
  /** Which demo situation this customer starts in. */
  about?: string
}

export interface AppConfig {
  personas: Persona[]
  catalogue: { type: string; priority: Priority; meaning: string }[]
  gemini_configured: boolean
  gemini_model: string | null
  fcm_enabled: boolean
  demo_key_required: boolean
  switches: Switches
}

export interface Switches {
  enrich_mode: 'gemini' | 'template'
  simulate_gemini_failure: boolean
  coalesce: boolean
}
