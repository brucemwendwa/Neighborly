import { useEffect, useState } from 'react'
import api from '../api/client'

const PILLARS = [
  { title: 'Services', body: 'Book a plumber, cleaner or electrician who already works in your estate.' },
  { title: 'Housing', body: 'Browse verified vacant units without going through a broker.' },
  { title: 'Moving', body: 'Request a truck, loaders and packers as one job.' },
  { title: 'Commute', body: 'Share the drive to town with neighbours going your way.' },
  { title: 'Gate Passes', body: 'Issue a QR code so security can admit your visitor.' },
]

export default function Home() {
  const [health, setHealth] = useState('checking…')

  // Proves the client → proxy → Express → Postgres path works end to end.
  // Delete this once you have real pages.
  useEffect(() => {
    api
      .get('/health')
      .then(({ data }) => setHealth(`API ${data.status} · DB ${data.database}`))
      .catch((err) => setHealth(`unreachable — ${err.message}`))
  }, [])

  return (
    <>
      <section className="hero">
        <h1>Everything your estate needs, in one place.</h1>
        <p>
          Jirani Hub connects residents with trusted providers, housing, moving
          help and daily commutes — all scoped to the community you live in.
        </p>
        <p className="health">Backend status: {health}</p>
      </section>

      <section className="pillars">
        {PILLARS.map((p) => (
          <article key={p.title} className="card">
            <h2>{p.title}</h2>
            <p>{p.body}</p>
          </article>
        ))}
      </section>
    </>
  )
}
