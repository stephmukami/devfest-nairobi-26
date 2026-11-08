// Storage can throw (private mode, blocked site data). Never let that break the demo.

export function load(key: string, fallback: string, store: 'local' | 'session' = 'local'): string {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage
    return s.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: string, store: 'local' | 'session' = 'local'): void {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage
    s.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/** One id per page load. Not sessionStorage: duplicated tabs copy it and would share presence. */
const pageClientId = 'tab_' + Math.random().toString(36).slice(2, 12)
export const tabClientId = (): string => pageClientId
