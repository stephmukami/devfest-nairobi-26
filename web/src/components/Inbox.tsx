import { useEffect, useRef, useState } from 'react'
import { timeOf } from '../lib/format'
import { NotificationIcon } from '../lib/icons'
import type { InboxItem } from '../lib/types'

interface Props {
  items: InboxItem[]
  onOpenPanel: () => void
  onOpenItem: (item: InboxItem) => void
}

export function Inbox({ items, onOpenPanel, onOpenItem }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = items.filter((i) => !i.read).length

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="inbox" ref={ref}>
      <button
        className="bell"
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => {
          setOpen((o) => !o)
          if (!open) onOpenPanel()
        }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.5A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.5L18 12.6V9a6 6 0 0 0-6-6Zm0 19a3 3 0 0 0 2.8-2H9.2A3 3 0 0 0 12 22Z"
            fill="currentColor"
          />
        </svg>
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      {open && (
        <div className="inbox-panel">
          <h3>Notifications</h3>
          {items.length === 0 && <p className="muted">Nothing yet.</p>}
          <ul>
            {items.map((item) => (
              <li key={item.event_id} className={`inbox-item p-${item.priority} ${item.read ? '' : 'unread'}`}>
                <button
                  onClick={() => {
                    setOpen(false)
                    onOpenItem(item)
                  }}
                >
                  <span className="note-icon">
                    <NotificationIcon name={item.icon} size={18} />
                  </span>
                  <span className="note-text">
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                    <time>{timeOf(item.created_at)}</time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
