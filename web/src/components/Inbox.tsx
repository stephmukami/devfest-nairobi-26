import { useEffect, useRef, useState } from 'react'
import { timeOf } from '../lib/format'
import { Icon, NotificationIcon } from '../lib/icons'
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
        <Icon name="bell" size={22} />
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
