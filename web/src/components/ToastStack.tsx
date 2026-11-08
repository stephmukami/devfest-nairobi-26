import { useEffect } from 'react'
import { NotificationIcon } from '../lib/icons'
import type { Priority } from '../lib/types'

export interface Toast {
  id: string
  title: string
  body: string
  icon: string
  priority: Priority
  sticky: boolean
  parcelId: string | null
  via: 'sse' | 'fcm'
}

interface Props {
  toasts: Toast[]
  onDismiss: (id: string) => void
  onOpen: (t: Toast) => void
}

function ToastCard({ toast, onDismiss, onOpen }: { toast: Toast } & Omit<Props, 'toasts'>) {
  useEffect(() => {
    if (toast.sticky) return
    const t = window.setTimeout(() => onDismiss(toast.id), 7000)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss])

  return (
    <div className={`toast toast-${toast.priority}`} role={toast.priority === 'critical' ? 'alert' : 'status'}>
      <button className="toast-main" onClick={() => onOpen(toast)}>
        <span className="note-icon">
          <NotificationIcon name={toast.icon} />
        </span>
        <span className="note-text">
          <strong>{toast.title}</strong>
          <span>{toast.body}</span>
        </span>
      </button>
      <button className="toast-close" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
        ×
      </button>
      {toast.sticky && <span className="toast-tag">Needs action</span>}
    </div>
  )
}

export function ToastStack({ toasts, onDismiss, onOpen }: Props) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} onOpen={onOpen} />
      ))}
    </div>
  )
}
