import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Inter for text, Sora for display. Self-hosted rather than pulled from a CDN,
// so the estate app still renders correctly on a phone with no connection —
// the same reason the source project compiles them in at build time.
import '@fontsource-variable/inter'
import '@fontsource-variable/sora'

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
