/**
 * The brand mark: a house glyph on an olive-to-bark tile, with a gold pip.
 *
 * `tone="light"` is for placement over the hero photograph or a dark band —
 * the olive wordmark drops below 3:1 against the image, so the second half of
 * the name switches to a pale olive and the tile gets a ring instead of a glow.
 */
export default function Logo({ markOnly = false, tone = 'default' }) {
  return (
    <span className={`logo${tone === 'light' ? ' logo-light' : ''}`}>
      <span className="logo-mark">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
        <span className="logo-pip" />
      </span>
      {!markOnly && (
        <span className="logo-word">
          Jirani<span>&nbsp;Hub</span>
        </span>
      )}
    </span>
  )
}
