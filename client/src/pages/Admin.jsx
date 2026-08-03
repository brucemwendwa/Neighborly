import { useState } from 'react'
import { PageHeader } from '../components/ui'

import Overview from './admin/Overview'
import ProviderQueue from './admin/ProviderQueue'
import ListingQueue from './admin/ListingQueue'
import Catalogue from './admin/Catalogue'
import People from './admin/People'
import Estates from './admin/Estates'

/**
 * Admin console — the queues an estate admin works through.
 *
 * This file is only the tab bar. Each tab is a component in pages/admin/,
 * one file per job, so "show me the approval queue" is one file rather
 * than a scroll through six screens' worth of code.
 *
 * Everything here is admin-only on the server too — the route guard just
 * keeps the link out of the way of people who cannot use it.
 */
const TABS = [
  ['overview', 'Overview', Overview],
  ['providers', 'Provider approvals', ProviderQueue],
  ['listings', 'Listing verification', ListingQueue],
  ['catalogue', 'Catalogue', Catalogue],
  ['people', 'People', People],
  ['estates', 'Estates', Estates],
]

export default function Admin() {
  const [active, setActive] = useState('overview')

  // Pick the component whose key matches, and render it. Adding a tab is
  // one line in TABS plus one file.
  const ActiveTab = TABS.find(([key]) => key === active)[2]

  return (
    <>
      <PageHeader
        title="Admin"
        description="Approvals, verification and the shared service catalogue."
      />

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab ${active === key ? 'active' : ''}`}
            onClick={() => setActive(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <ActiveTab />
    </>
  )
}
