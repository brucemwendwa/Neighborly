import { useTheme } from '../context/ThemeContext'

/**
 * Topbar control for the colour scheme. It shows the mode currently in force
 * and cycles system -> light -> dark on click; the label spells the next step
 * out because an icon alone cannot say "follow my OS".
 */
const THEME_LABELS = {
  system: { icon: '🖥️', name: 'System', next: 'light' },
  light: { icon: '☀️', name: 'Light', next: 'dark' },
  dark: { icon: '🌙', name: 'Dark', next: 'system' },
}

export default function ThemeToggle() {
  const { theme, resolved, cycle } = useTheme()
  const current = THEME_LABELS[theme]
  const hint =
    theme === 'system'
      ? `Theme: System (${resolved}) — switch to ${current.next}`
      : `Theme: ${current.name} — switch to ${THEME_LABELS[current.next].name.toLowerCase()}`

  return (
    <button type="button" onClick={cycle} className="theme-toggle" title={hint} aria-label={hint}>
      <span aria-hidden="true">{current.icon}</span>
    </button>
  )
}
