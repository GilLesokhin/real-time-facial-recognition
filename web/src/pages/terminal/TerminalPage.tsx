import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCamera } from '../../hooks/useCamera'
import { useFaceDetection, type FaceShot } from '../../hooks/useFaceDetection'
import { api, ApiError, errorMessage } from '../../lib/api'
import { toScreenBox, type ScreenBox } from '../../lib/face/detector'
import { formatTime } from '../../lib/format'
import type { IdentifyResult, TerminalScreen } from '../../types'

type Phase = 'idle' | 'checking' | 'granted' | 'denied'

/** After "granted" the door opens and closes: no requests for this long. */
const GRANTED_HOLD_MS = 10_000
/** How long "denied" stays on screen, unless the next request's result replaces it sooner. */
const DENIED_SHOW_MS = 3000
const MAX_REQUESTS_SHOWN = 4

/** One identify request. Shown in the request panel. */
interface SentRequest {
  id: number
  at: Date
  shot: FaceShot
  thumbUrl: string
  status: 'pending' | 'granted' | 'denied' | 'error'
  personName: string | null
  score: number | null
  error: string | null
}

/**
 * The terminal's sign-in key. "Open terminal" puts it in the URL #fragment. It moves to
 * sessionStorage (this tab only) and leaves the address bar, so a reload still works.
 */
function useTerminalKey(terminalId: string | undefined) {
  const [key] = useState(() => {
    if (!terminalId) return null
    const storageKey = `terminal-key-${terminalId}`
    const fromUrl = new URLSearchParams(window.location.hash.slice(1)).get('key')
    if (fromUrl) {
      sessionStorage.setItem(storageKey, fromUrl)
      window.history.replaceState(null, '', window.location.pathname)
      return fromUrl
    }
    return sessionStorage.getItem(storageKey)
  })
  return key
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

function requestText(r: SentRequest) {
  if (r.status === 'pending') return 'waiting…'
  if (r.status === 'error') return r.error
  const result = r.status === 'granted' ? `granted: ${r.personName}` : 'denied'
  return r.score === null ? result : `${result} · score ${r.score.toFixed(2)}`
}

export function TerminalPage() {
  const { terminalId } = useParams()
  const key = useTerminalKey(terminalId)
  const { videoRef, status } = useCamera()

  const [screen, setScreen] = useState<TerminalScreen | null>(null)
  const [signedOut, setSignedOut] = useState(!key)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [matchName, setMatchName] = useState<string | null>(null)
  const [requests, setRequests] = useState<SentRequest[]>([])
  const [now, setNow] = useState(() => new Date())
  const nextRequestId = useRef(1)

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 10_000)
    return () => window.clearInterval(clock)
  }, [])

  // GET /terminals/{id}: the names to show. Refused if the key is missing, old or wrong.
  useEffect(() => {
    if (!key || !terminalId) return
    api<TerminalScreen>(`/terminals/${terminalId}`, { headers: { Authorization: `Bearer ${key}` } })
      .then(setScreen)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setSignedOut(true)
        else setLoadError(errorMessage(err))
      })
  }, [key, terminalId])

  // Free the thumbnails' memory when they leave the panel or the page closes.
  const thumbs = useRef(new Set<string>())
  useEffect(() => {
    const shown = new Set(requests.map((r) => r.thumbUrl))
    thumbs.current.forEach((u) => !shown.has(u) && URL.revokeObjectURL(u))
    thumbs.current = shown
  }, [requests])
  useEffect(() => () => thumbs.current.forEach((u) => URL.revokeObjectURL(u)), [])

  /**
   * POST /terminals/{id}/identify with the face crop. One request at a time. After "granted",
   * nothing is sent for GRANTED_HOLD_MS. After "denied", sending goes on at once: the person
   * may still be getting into position.
   */
  const canSend = phase === 'idle' || phase === 'denied'
  const resultTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(resultTimer.current), [])

  const identify = async (shot: FaceShot) => {
    if (!screen || !key || !canSend) return
    window.clearTimeout(resultTimer.current)
    const id = nextRequestId.current++
    const request: SentRequest = {
      id,
      at: new Date(),
      shot,
      thumbUrl: URL.createObjectURL(shot.jpeg),
      status: 'pending',
      personName: null,
      score: null,
      error: null,
    }
    setRequests((rs) => [request, ...rs].slice(0, MAX_REQUESTS_SHOWN))
    setPhase('checking')
    setMatchName(null)

    const form = new FormData()
    form.set('image', shot.jpeg, 'face.jpg')
    try {
      const res = await api<IdentifyResult>(`/terminals/${screen.id}/identify`, {
        method: 'POST',
        form,
        headers: { Authorization: `Bearer ${key}` },
      })
      const name = res.person?.name ?? null
      setRequests((rs) =>
        rs.map((r) => (r.id === id ? { ...r, status: res.result, personName: name, score: res.score } : r)),
      )
      setPhase(res.result)
      setMatchName(name)
      resultTimer.current = window.setTimeout(
        () => {
          setPhase('idle')
          setMatchName(null)
        },
        res.result === 'granted' ? GRANTED_HOLD_MS : DENIED_SHOW_MS,
      )
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setSignedOut(true)
      setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'error', error: errorMessage(err) } : r)))
      setPhase('idle')
    }
  }

  const { live, modelStatus } = useFaceDetection(videoRef, {
    sending: canSend && !!screen && !signedOut,
    onShot: (shot) => void identify(shot),
  })

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

  if (signedOut || loadError) {
    return (
      <div className="center-page">
        <p className="muted">
          {loadError ?? "This terminal isn't signed in. Open it again from the Terminals page in the admin panel."}
        </p>
        <Link to="/" className="btn">
          Home
        </Link>
      </div>
    )
  }
  if (!screen) return null

  const message = {
    idle: live?.best ? 'Hold still…' : 'Look at the camera',
    checking: 'Checking…',
    granted: `Welcome${matchName ? `, ${matchName.split(' ')[0]}` : ''}`,
    denied: 'Not recognized. Please contact the building admin.',
  }[phase]

  const cameraText = status === 'live' ? 'Camera live' : status === 'starting' ? 'Starting camera' : 'Camera unavailable'
  const modelText = { loading: 'Loading face model', ready: 'Face model ready', error: 'Face model failed' }[modelStatus]

  return (
    <div className="terminal">
      <header className="terminal-header">
        <div>
          <span className="label">{screen.building_name}</span>
          <h1 className="title">{screen.name}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="title">{formatTime(now)}</span>
          <span className={`status-dot small muted${status === 'live' ? '' : ' off'}`}>{cameraText}</span>
          <span className={`status-dot small muted${modelStatus === 'ready' ? '' : ' off'}`}>{modelText}</span>
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
              {phase === 'granted' && matchName && <span className="face-name">{matchName}</span>}
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
            <img src={r.thumbUrl} alt="" className="request-thumb" />
            <div className="request-body">
              <code className="small">POST /terminals/{screen.id}/identify</code>
              <span className="small muted">
                image/jpeg {r.shot.cropSize}×{r.shot.cropSize} · {kb(r.shot.jpeg.size)}
              </span>
              <span className="small faint">
                confidence {r.shot.score.toFixed(2)} · face in {r.shot.framesWithFace}/{r.shot.frames} frames · detect{' '}
                {r.shot.detectMs.toFixed(0)} ms
              </span>
              <span className={`small request-status ${r.status === 'error' ? 'denied' : r.status}`}>
                {formatTime(r.at)} · {requestText(r)}
              </span>
            </div>
          </div>
        ))}
      </aside>
    </div>
  )
}
