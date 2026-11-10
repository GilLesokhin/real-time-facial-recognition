import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCamera } from '../../hooks/useCamera'
import { formatTime } from '../../lib/format'
import { useStore } from '../../store/store'
import type { Person } from '../../types'

type Phase = 'idle' | 'checking' | 'granted' | 'denied'

const CHECK_MS = 900
const RESULT_MS = 3000
const UNKNOWN = '__unknown'

function Silhouette() {
  return (
    <svg className="camera-placeholder" viewBox="0 0 880 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="880" height="560" fill="#131313" />
      <circle cx="440" cy="225" r="88" fill="#1c1c1c" />
      <path d="M250 560 C 260 400, 360 340, 440 340 C 520 340, 620 400, 630 560 Z" fill="#1c1c1c" />
    </svg>
  )
}

export function TerminalPage() {
  const { terminalId } = useParams()
  const { state, logEvent } = useStore()
  const { videoRef, status } = useCamera()

  const terminal = state.terminals.find((t) => t.id === terminalId)
  const building = state.buildings.find((b) => b.id === terminal?.buildingId)
  const people = state.people.filter((p) => p.buildingId === terminal?.buildingId)

  const [phase, setPhase] = useState<Phase>('idle')
  const [match, setMatch] = useState<Person | null>(null)
  const [simulateAs, setSimulateAs] = useState(people[0]?.id ?? UNKNOWN)
  const [now, setNow] = useState(() => new Date())
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 10_000)
    const pending = timers.current
    return () => {
      window.clearInterval(clock)
      pending.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  if (!terminal || !building) {
    return (
      <div className="center-page">
        <p className="muted">This terminal no longer exists.</p>
        <Link to="/admin/terminals" className="btn">
          All terminals
        </Link>
      </div>
    )
  }

  // Stand-in for the backend similarity search: the demo panel decides who is "seen".
  const runCheck = () => {
    if (phase !== 'idle') return
    const person = people.find((p) => p.id === simulateAs) ?? null
    setPhase('checking')
    setMatch(null)
    timers.current.push(
      window.setTimeout(() => {
        const result = person ? 'granted' : 'denied'
        setPhase(result)
        setMatch(person)
        logEvent(terminal, result, person?.id ?? null)
        timers.current.push(
          window.setTimeout(() => {
            setPhase('idle')
            setMatch(null)
          }, RESULT_MS),
        )
      }, CHECK_MS),
    )
  }

  const message = {
    idle: 'Look at the camera',
    checking: 'Checking…',
    granted: `Welcome${match ? `, ${match.name.split(' ')[0]}` : ''}`,
    denied: 'Not recognized. Please contact the building admin.',
  }[phase]

  return (
    <div className="terminal">
      <header className="terminal-header">
        <div>
          <span className="label">{building.name}</span>
          <h1 className="title">{terminal.name}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="title">{formatTime(now)}</span>
          <span className={`status-dot small muted${status === 'live' ? '' : ' off'}`}>
            {status === 'live' ? 'Camera live' : status === 'starting' ? 'Starting camera' : 'Camera unavailable'}
          </span>
        </div>
      </header>

      <div className="terminal-stage">
        <div className="camera">
          <video ref={videoRef} muted playsInline style={{ visibility: status === 'live' ? 'visible' : 'hidden' }} />
          {status !== 'live' && <Silhouette />}
          <span className="camera-label label">Camera</span>
          <div className={`face-box ${phase}`}>
            {(phase === 'granted' || phase === 'denied') && (
              <span className={`face-tag ${phase}`}>{phase === 'granted' ? 'Access granted' : 'Access denied'}</span>
            )}
            {phase === 'granted' && match && <span className="face-name">{match.name}</span>}
          </div>
        </div>
      </div>

      <footer className="terminal-footer">
        <p className="heading muted" aria-live="polite">
          {message}
        </p>
      </footer>

      <aside className="demo-panel card">
        <span className="label">Demo controls</span>
        <p className="small faint">No backend: choose who the camera "sees", then run a check.</p>
        <select className="select" value={simulateAs} onChange={(e) => setSimulateAs(e.target.value)}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.unit}
            </option>
          ))}
          <option value={UNKNOWN}>Unknown face</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={runCheck} disabled={phase !== 'idle'}>
          Simulate face check
        </button>
      </aside>
    </div>
  )
}
