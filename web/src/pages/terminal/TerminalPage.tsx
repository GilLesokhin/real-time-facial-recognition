import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCamera } from '../../hooks/useCamera'
import { useFaceDetection, type FaceShot } from '../../hooks/useFaceDetection'
import { toScreenBox, type ScreenBox } from '../../lib/face/detector'
import { formatTime } from '../../lib/format'
import { useStore } from '../../store/store'
import type { Person } from '../../types'

type Phase = 'idle' | 'checking' | 'granted' | 'denied'

/** Stand-in for the server's response time. */
const MOCK_SERVER_MS = 400
/** After "granted" the door opens and closes: no requests for this long. */
const GRANTED_HOLD_MS = 10_000
/** How long "denied" stays on screen, unless the next request's result replaces it sooner. */
const DENIED_SHOW_MS = 3000
const MAX_REQUESTS_SHOWN = 4
const UNKNOWN = '__unknown'

/** One identify request, as the terminal would send it. Shown in the request panel. */
interface SentRequest {
  id: number
  at: Date
  shot: FaceShot | null
  thumbUrl: string | null
  status: 'pending' | 'granted' | 'denied'
  personName: string | null
}

function Silhouette() {
  return (
    <svg className="camera-placeholder" viewBox="0 0 880 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="880" height="560" fill="#131313" />
      <circle cx="440" cy="225" r="88" fill="#1c1c1c" />
      <path d="M250 560 C 260 400, 360 340, 440 340 C 520 340, 620 400, 630 560 Z" fill="#1c1c1c" />
    </svg>
  )
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

export function TerminalPage() {
  const { terminalId } = useParams()
  const { state, logEvent } = useStore()
  const { videoRef, status } = useCamera()

  const terminal = state.terminals.find((t) => t.id === terminalId)
  const building = state.buildings.find((b) => b.id === terminal?.building_id)
  const people = state.people.filter((p) => p.building_id === terminal?.building_id)

  const [phase, setPhase] = useState<Phase>('idle')
  const [match, setMatch] = useState<Person | null>(null)
  const [simulateAs, setSimulateAs] = useState(people[0]?.id ?? UNKNOWN)
  const [requests, setRequests] = useState<SentRequest[]>([])
  const [now, setNow] = useState(() => new Date())
  const timers = useRef<number[]>([])
  const nextRequestId = useRef(1)

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 10_000)
    const pending = timers.current
    return () => {
      window.clearInterval(clock)
      pending.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  // Free the thumbnails' memory when they leave the panel or the page closes.
  const thumbs = useRef(new Set<string>())
  useEffect(() => {
    const shown = new Set(requests.map((r) => r.thumbUrl).filter((u): u is string => !!u))
    thumbs.current.forEach((u) => !shown.has(u) && URL.revokeObjectURL(u))
    thumbs.current = shown
  }, [requests])
  useEffect(() => () => thumbs.current.forEach((u) => URL.revokeObjectURL(u)), [])

  /**
   * POST /terminals/{id}/identify. Mocked: the demo panel decides who the server "recognizes".
   * One request at a time. After "granted", nothing is sent for GRANTED_HOLD_MS. After "denied",
   * sending goes on at once: the person may still be getting into position.
   */
  const canSend = phase === 'idle' || phase === 'denied'
  const resultTimer = useRef<number | undefined>(undefined)
  const identify = (shot: FaceShot | null) => {
    if (!terminal || !canSend) return
    window.clearTimeout(resultTimer.current)
    const person = people.find((p) => p.id === simulateAs) ?? null
    const id = nextRequestId.current++
    const request: SentRequest = {
      id,
      at: new Date(),
      shot,
      thumbUrl: shot ? URL.createObjectURL(shot.jpeg) : null,
      status: 'pending',
      personName: null,
    }
    setRequests((rs) => [request, ...rs].slice(0, MAX_REQUESTS_SHOWN))
    setPhase('checking')
    setMatch(null)

    timers.current.push(
      window.setTimeout(() => {
        const result = person ? 'granted' : 'denied'
        setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status: result, personName: person?.name ?? null } : r)))
        setPhase(result)
        setMatch(person)
        logEvent(terminal, result, person?.id ?? null)
        resultTimer.current = window.setTimeout(
          () => {
            setPhase('idle')
            setMatch(null)
          },
          result === 'granted' ? GRANTED_HOLD_MS : DENIED_SHOW_MS,
        )
        timers.current.push(resultTimer.current)
      }, MOCK_SERVER_MS),
    )
  }

  const { live, model } = useFaceDetection(videoRef, { sending: canSend && !!terminal, onShot: identify })

  // Place the face box over the live face. While a result shows, it stays where the face was.
  const cameraRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<ScreenBox | null>(null)
  useLayoutEffect(() => {
    const el = cameraRef.current
    if (!live?.best?.boundingBox || !el) {
      if (phase === 'idle') setBox(null)
      return
    }
    setBox(toScreenBox(live.best.boundingBox, live.video, { width: el.clientWidth, height: el.clientHeight }, true))
  }, [live, phase])

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

  const message = {
    idle: live?.best ? 'Hold still…' : 'Look at the camera',
    checking: 'Checking…',
    granted: `Welcome${match ? `, ${match.name.split(' ')[0]}` : ''}`,
    denied: 'Not recognized. Please contact the building admin.',
  }[phase]

  const cameraText = status === 'live' ? 'Camera live' : status === 'starting' ? 'Starting camera' : 'Camera unavailable'
  const modelText = { loading: 'Loading face model', ready: 'Face model ready', error: 'Face model failed' }[model.status]

  return (
    <div className="terminal">
      <header className="terminal-header">
        <div>
          <span className="label">{building.name}</span>
          <h1 className="title">{terminal.name}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="title">{formatTime(now)}</span>
          <span className={`status-dot small muted${status === 'live' ? '' : ' off'}`}>{cameraText}</span>
          <span className={`status-dot small muted${model.status === 'ready' ? '' : ' off'}`}>{modelText}</span>
        </div>
      </header>

      <div className="terminal-stage">
        <div className="camera" ref={cameraRef}>
          <video ref={videoRef} muted playsInline style={{ visibility: status === 'live' ? 'visible' : 'hidden' }} />
          {status !== 'live' && <Silhouette />}
          <span className="camera-label label">Camera</span>
          {(box || phase !== 'idle') && (
            <div
              className={`face-box ${phase}`}
              style={box ? { left: box.left, top: box.top, width: box.width, height: box.height } : undefined}
            >
              {(phase === 'granted' || phase === 'denied') && (
                <span className={`face-tag ${phase}`}>{phase === 'granted' ? 'Access granted' : 'Access denied'}</span>
              )}
              {phase === 'granted' && match && <span className="face-name">{match.name}</span>}
            </div>
          )}
        </div>
      </div>

      <footer className="terminal-footer">
        <p className="heading muted" aria-live="polite">
          {message}
        </p>
      </footer>

      <aside className="request-panel card">
        <span className="label">Requests to server</span>
        <p className="small faint">The best face of each second is cropped and sent. After "granted", nothing is sent for 10 s.</p>
        {requests.length === 0 && <p className="small faint">No requests yet.</p>}
        {requests.map((r) => (
          <div key={r.id} className="request">
            {r.thumbUrl ? <img src={r.thumbUrl} alt="" className="request-thumb" /> : <div className="request-thumb" />}
            <div className="request-body">
              <code className="small">POST /terminals/{terminal.id}/identify</code>
              {r.shot ? (
                <>
                  <span className="small muted">
                    image/jpeg {r.shot.cropSize}×{r.shot.cropSize} · {kb(r.shot.jpeg.size)}
                  </span>
                  <span className="small faint">
                    score {r.shot.score.toFixed(2)} · face in {r.shot.framesWithFace}/{r.shot.frames} frames · detect{' '}
                    {r.shot.detectMs.toFixed(0)} ms
                  </span>
                </>
              ) : (
                <span className="small faint">Simulated, no camera image</span>
              )}
              <span className={`small request-status ${r.status}`}>
                {formatTime(r.at)} ·{' '}
                {r.status === 'pending' ? 'waiting…' : r.status === 'granted' ? `granted: ${r.personName}` : 'denied'}
              </span>
            </div>
          </div>
        ))}
      </aside>

      <aside className="demo-panel card">
        <span className="label">Demo controls</span>
        <p className="small faint">No backend yet: choose who the server "recognizes" for the next request.</p>
        <select className="select" value={simulateAs} onChange={(e) => setSimulateAs(e.target.value)}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.unit}
            </option>
          ))}
          <option value={UNKNOWN}>Unknown face</option>
        </select>
        <button type="button" className="btn" onClick={() => identify(null)} disabled={!canSend}>
          Simulate without camera
        </button>
      </aside>
    </div>
  )
}
