import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Light / dark / follow-the-OS, for the whole app.
 *
 * The palettes themselves live in index.css — this only decides which one
 * wins. Three states rather than a plain on/off switch:
 *
 *   'system'  no data-theme attribute, so the prefers-color-scheme media
 *             query in the stylesheet decides. The default.
 *   'light'   data-theme="light" on <html>, which beats a dark OS setting.
 *   'dark'    data-theme="dark", which beats a light one.
 *
 * Keeping 'system' as a real state (rather than only remembering the last
 * explicit pick) means a reader who never touches the toggle still tracks
 * their OS when it flips at sunset, and anyone who does touch it can get
 * that behaviour back.
 *
 * The stored value is read a second time by a small inline script in
 * index.html. That runs before React mounts, so a saved choice is on the
 * element before first paint and the other palette never flashes.
 */
const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

const ThemeContext = createContext(null)

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    // Private browsing can make localStorage throw on read.
    return 'system'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches)

  // Watch the OS setting so 'system' stays live — otherwise the app would
  // only pick up a change at the next full reload.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // What is actually on screen right now, with 'system' resolved to one or
  // the other. This is what the toggle flips away from.
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    try {
      if (theme === 'system') {
        delete root.dataset.theme
        localStorage.removeItem(STORAGE_KEY)
      } else {
        root.dataset.theme = theme
        localStorage.setItem(STORAGE_KEY, theme)
      }
    } catch {
      // Storage is optional — the attribute is what drives the styling, so
      // the theme still applies for this session.
      if (theme !== 'system') root.dataset.theme = theme
    }
  }, [theme])

  // system -> light -> dark -> system. A cycle rather than a switch, so the
  // 'system' default is reachable again after an explicit pick.
  const cycle = useCallback(() => {
    setTheme((current) => {
      if (current === 'system') return 'light'
      if (current === 'light') return 'dark'
      return 'system'
    })
  }, [])

  const value = useMemo(
    () => ({ theme, resolved, setTheme, cycle }),
    [theme, resolved, cycle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside a <ThemeProvider>')
  return ctx
}
