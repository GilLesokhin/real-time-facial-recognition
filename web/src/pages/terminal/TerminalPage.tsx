import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCamera } from '../../hooks/useCamera'
import { useFaceDetection, type FaceShot } from '../../hooks/useFaceDetection'
import { api, ApiError } from '../../lib/api'
import { toScreenBox, type BoundingBox, type ScreenBox } from '../../lib/face/detector'
import { formatTime } from '../../lib/format'
import type { IdentifyResponse, TerminalKey } from '../../types'

/** What the door shows. Only "granted" has a name. */
type Door = { phase: 'idle' } | { phase: 'checking' } | { phase: 'granted'; personName: string } | { phase: 'denied' }

/** After "granted" the door opens and closes: no requests for this long. */
const GRANTED_HOLD_MS = 7000
/** How long "denied" stays on screen. No retry until it ends. */
const DENIED_SHOW_MS = 3500
const MAX_REQUESTS_SHOWN = 4
/** A result ends early when no face is seen for this long: the person walked away. */
const FACE_GONE_MS = 1000
/** A result ends early when the face's centre moves more than this, in face widths: a new person. */
const FACE_JUMP = 0.5

/** One identify request the terminal sent. Shown in the request panel. */
interface SentRequest {
  id: number
  at: Date
  shot: FaceShot
  thumbUrl: string
  status: 'pending' | 'granted' | 'denied' | 'failed'
  personName: string | null
  /** Time from sending to the answer. Null while waiting. */
  ms: number | null
  /** Why the request failed, for the panel. */
  error: string | null
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


/** The terminal's sign-in. Its `key` lives only in this tab's memory: never in localStorage or the URL. */
type SignIn =
  | { status: 'loading' }
  | { status: 'needsAdmin' }
  | { status: 'notFound' }
  | { status: 'offline' }
  /** The key stopped working: the terminal was removed or its building closed. */
  | { status: 'revoked' }
  | { status: 'ready'; terminal: TerminalKey }

/**
 * GET /terminals/:id/key with the admin cookie, once. It returns the key and the names to show.
 * Identify sends only the key. A reload starts again, so it needs an admin signed in in this browser.
 * Call `revoke` when the server refuses the key.
 */
function useTerminalSignIn(terminalId: string | undefined) {
  const [signIn, setSignIn] = useState<SignIn>({ status: 'loading' })

  useEffect(() => {
    if (!terminalId) return
    let cancelled = false
    api<TerminalKey>(`/terminals/${terminalId}/key`)
      .then((terminal) => !cancelled && setSignIn({ status: 'ready', terminal }))
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) setSignIn({ status: 'needsAdmin' })
        else if (err instanceof ApiError && err.status === 404) setSignIn({ status: 'notFound' })
        else setSignIn({ status: 'offline' })
      })
    return () => {
      cancelled = true
    }
  }, [terminalId])

  return { signIn, revoke: () => setSignIn({ status: 'revoked' }) }
}

const SIGN_IN_FAILED: Record<Exclude<SignIn['status'], 'loading' | 'ready'>, string> = {
  needsAdmin: 'Open this terminal from the admin panel.',
  notFound: 'This terminal no longer exists.',
  offline: "Can't reach the server. Reload the page to try again.",
  revoked: 'This terminal is no longer signed in. Open it again from the admin panel.',
}

function SignInFailed({ status }: { status: keyof typeof SIGN_IN_FAILED }) {
  return (
    <div className="center-page">
      <p className="muted">{SIGN_IN_FAILED[status]}</p>
      <Link to={status === 'needsAdmin' ? '/login' : '/'} className="btn">
        {status === 'needsAdmin' ? 'Sign in' : 'Home'}
      </Link>
    </div>
  )
}

const centreDistance = (a: BoundingBox, b: BoundingBox) =>
  Math.hypot(a.originX + a.width / 2 - (b.originX + b.width / 2), a.originY + a.height / 2 - (b.originY + b.height / 2))

/** How far the box moves toward the new face each frame (0–1) when the face barely moves. */
const BOX_SMOOTHING_SLOW = 0.3
/** A move of this many box widths or more makes the box jump straight to the new face. */
const BOX_FULL_SPEED_MOVE = 0.5

/**
 * Moves the box part of the way to the new face. Small moves (the detector's wobble) are smoothed.
 * The bigger the move, the faster the box follows, so it speeds up when the person moves.
 */
const smoothBox = (prev: ScreenBox, next: ScreenBox): ScreenBox => {
  const move = Math.hypot(next.left - prev.left, next.top - prev.top) / prev.width
  const speed = Math.min(1, BOX_SMOOTHING_SLOW + (1 - BOX_SMOOTHING_SLOW) * (move / BOX_FULL_SPEED_MOVE))
  const step = (a: number, b: number) => a + (b - a) * speed
  return {
    left: step(prev.left, next.left),
    top: step(prev.top, next.top),
    width: step(prev.width, next.width),
    height: step(prev.height, next.height),
  }
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

const requestStatusText = (r: SentRequest) => {
  if (r.status === 'pending') return 'Waiting…'
  if (r.status === 'granted') return `Granted: ${r.personName}`
  if (r.status === 'failed') return `Failed: ${r.error}`
  return 'Denied'
}

/** The last few identify requests, for checking what the door sends and how fast the answer comes. */
function RequestPanel({ requests }: { requests: SentRequest[] }) {
  // Free the thumbnails' memory when they leave the panel or the page closes.
  const thumbs = useRef(new Set<string>())
  useEffect(() => {
    const shown = new Set(requests.map((r) => r.thumbUrl))
    thumbs.current.forEach((u) => !shown.has(u) && URL.revokeObjectURL(u))
    thumbs.current = shown
  }, [requests])
  useEffect(() => () => thumbs.current.forEach((u) => URL.revokeObjectURL(u)), [])

  return (
    <aside className="request-panel card">
      <span className="label">Requests to server</span>
      {requests.length === 0 && <p className="small faint">No requests yet.</p>}
      {requests.map((r) => (
        <div key={r.id} className="request">
          <img src={r.thumbUrl} alt="" className="request-thumb mirrored" />
          <div className="request-body">
            <code className="small">POST /terminals/{'{terminal_id}'}/identify</code>
            <span className="small muted">
              image/jpeg {r.shot.cropSize}×{r.shot.cropSize} · {kb(r.shot.jpeg.size)}
            </span>
            <span className="small faint">Face detection in browser: {r.shot.detectMs.toFixed(0)} ms</span>
            <span className="small faint">Server response: {r.ms === null ? '…' : `${r.ms.toFixed(0)} ms`}</span>
            <span className={`small request-status ${r.status}`}>
              {formatTime(r.at)} · {requestStatusText(r)}
            </span>
          </div>
        </div>
      ))}
    </aside>
  )
}

export function TerminalPage() {
  const { terminalId } = useParams()
  const { videoRef, status } = useCamera()
  const { signIn, revoke } = useTerminalSignIn(terminalId)

  const terminal = signIn.status === 'ready' ? signIn.terminal : null
  const [door, setDoor] = useState<Door>({ phase: 'idle' })
  const [requests, setRequests] = useState<SentRequest[]>([])
  const [now, setNow] = useState(() => new Date())
  const nextRequestId = useRef(1)
  const resultTimer = useRef<number | undefined>(undefined)
  /** The face the shown result belongs to, in video pixels, and when it was last seen. */
  const resultFace = useRef<{ box: BoundingBox; seenAt: number } | null>(null)

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 10_000)
    return () => {
      window.clearInterval(clock)
      window.clearTimeout(resultTimer.current)
    }
  }, [])

  /**
   * POST /terminals/{id}/identify with the face crop and the terminal's key.
   * One request at a time. Nothing is sent while a result shows: GRANTED_HOLD_MS after "granted",
   * DENIED_SHOW_MS after "denied". A result ends sooner when its face leaves, so a new person is quick.
   */
  const canSend = door.phase === 'idle'
  const updateRequest = (id: number, change: Partial<SentRequest>) =>
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)))

  const identify = (shot: FaceShot) => {
    if (!terminal || !canSend) return
    window.clearTimeout(resultTimer.current)
    const id = nextRequestId.current++
    const sentAt = performance.now()
    const request: SentRequest = {
      id,
      at: new Date(),
      shot,
      thumbUrl: URL.createObjectURL(shot.jpeg),
      status: 'pending',
      personName: null,
      ms: null,
      error: null,
    }
    setRequests((rs) => [request, ...rs].slice(0, MAX_REQUESTS_SHOWN))
    setDoor({ phase: 'checking' })

    const form = new FormData()
    form.set('photo', shot.jpeg, 'face.jpg')
    api<IdentifyResponse>(`/terminals/${terminal.id}/identify`, { method: 'POST', body: form, bearer: terminal.key })
      .then((answer) => {
        updateRequest(id, { status: answer.result, personName: answer.person_name, ms: performance.now() - sentAt })
        if (answer.result === 'granted') setDoor({ phase: 'granted', personName: answer.person_name ?? '' })
        else setDoor({ phase: 'denied' })
        resultFace.current = { box: shot.box, seenAt: performance.now() }
        resultTimer.current = window.setTimeout(
          () => setDoor({ phase: 'idle' }),
          answer.result === 'granted' ? GRANTED_HOLD_MS : DENIED_SHOW_MS,
        )
      })
      .catch((err) => {
        const error = err instanceof ApiError ? err.message : 'Request failed.'
        updateRequest(id, { status: 'failed', ms: performance.now() - sentAt, error })
        if (err instanceof ApiError && err.status === 401) revoke()
        // Any other failure: try again with the next face.
        setDoor({ phase: 'idle' })
      })
  }

  const { live, model } = useFaceDetection(videoRef, { sending: canSend && !!terminal, onShot: identify })

  // Place the face box over the live face. A result ends early when its face leaves or another face takes its place.
  const cameraRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<ScreenBox | null>(null)
  useLayoutEffect(() => {
    const el = cameraRef.current
    const face = live?.best?.boundingBox
    const showing = door.phase === 'granted' || door.phase === 'denied'
    const shownFace = resultFace.current
    if (showing && shownFace) {
      const now = performance.now()
      const gone = !face && now - shownFace.seenAt > FACE_GONE_MS
      const jumped = !!face && centreDistance(face, shownFace.box) > FACE_JUMP * shownFace.box.width
      if (gone || jumped) {
        window.clearTimeout(resultTimer.current)
        resultFace.current = null
        setDoor({ phase: 'idle' })
        setBox(null)
        return
      }
      if (face) resultFace.current = { box: face, seenAt: now }
    }
    if (!face || !el) {
      if (door.phase === 'idle') setBox(null)
      return
    }
    const target = toScreenBox(face, live.video, { width: el.clientWidth, height: el.clientHeight }, true)
    setBox((prev) => (prev ? smoothBox(prev, target) : target))
  }, [live, door.phase])

  if (signIn.status === 'loading') return null
  if (signIn.status !== 'ready') return <SignInFailed status={signIn.status} />
  const shown = signIn.terminal
  const { phase } = door
  const personName = door.phase === 'granted' ? door.personName : null

  const message = {
    idle: live?.best ? 'Hold still…' : 'Look at the camera',
    checking: 'Checking…',
    granted: `Welcome${personName ? `, ${personName.split(' ')[0]}` : ''}`,
    denied: 'Not recognized. Please contact the building admin.',
  }[phase]

  const cameraText = status === 'live' ? 'Camera live' : status === 'starting' ? 'Starting camera' : 'Camera unavailable'
  const modelText = { loading: 'Loading face model', ready: 'Face model ready', error: 'Face model failed' }[model.status]

  return (
    <div className="terminal">
      <header className="terminal-header">
        <div>
          <span className="label">{shown.building_name}</span>
          <h1 className="title">{shown.name}</h1>
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
              {phase === 'granted' && personName && <span className="face-name">{personName}</span>}
            </div>
          )}
        </div>
      </div>

      <footer className="terminal-footer">
        <p className="heading muted" aria-live="polite">
          {message}
        </p>
      </footer>

      <RequestPanel requests={requests} />
    </div>
  )
}
