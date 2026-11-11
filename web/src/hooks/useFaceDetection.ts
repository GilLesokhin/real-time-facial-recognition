import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  bestDetection,
  createFaceDetector,
  cropFace,
  DEFAULT_SETTINGS,
  isCloseEnough,
  scoreOf,
  toJpeg,
  type BoundingBox,
  type Delegate,
  type Detection,
  type DetectionSettings,
  type FaceDetector,
} from '../lib/face/detector'

interface VideoSize {
  width: number
  height: number
}

/** What the detector saw in the latest frame. */
export interface LiveFrame {
  /** Every face found, and whether it's close enough to act on. */
  faces: { detection: Detection; closeEnough: boolean }[]
  /** The face to act on: the best of the close-enough ones. */
  best: Detection | null
  video: VideoSize
  detectMs: number
}

/** The best face of one window, ready to send. */
export interface FaceShot {
  jpeg: Blob
  cropSize: number
  score: number
  /** In video pixels, unmirrored. */
  box: BoundingBox
  video: VideoSize
  /** Frames in the window with a usable face, out of all frames checked. */
  framesWithFace: number
  frames: number
  /** Average time one detection took in this window. */
  detectMs: number
}

/** A window where a face was seen but nothing was sent, and why. */
export interface SkippedWindow {
  reason: 'too far' | 'not steady'
  framesWithFace: number
  frames: number
}

interface Options {
  /** While false, faces are still tracked for the box, but nothing is handed over. */
  sending: boolean
  /** Called at most once per window, with the best face of that window. */
  onShot: (shot: FaceShot) => void
  /** Called when a window saw a face but didn't send it. */
  onSkip?: (skip: SkippedWindow) => void
  settings?: DetectionSettings
}

/**
 * Runs the face detector on the camera every `detectEveryMs`. Returns what the latest frame shows
 * (for drawing), and every `windowMs` hands the best face of that window to `onShot`.
 */
export function useFaceDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  { sending, onShot, onSkip, settings = DEFAULT_SETTINGS }: Options,
) {
  const [live, setLive] = useState<LiveFrame | null>(null)
  const [model, setModel] = useState<{ status: 'loading' | 'ready' | 'error'; delegate: Delegate | null; loadMs: number | null }>(
    { status: 'loading', delegate: null, loadMs: null },
  )
  const detectorRef = useRef<FaceDetector | null>(null)

  // The loop reads the latest props through refs, so changing a setting doesn't restart it.
  const latest = useRef({ sending, onShot, onSkip, settings })
  useEffect(() => {
    latest.current = { sending, onShot, onSkip, settings }
  })

  // 1. Load the model. Only a delegate change needs a reload.
  const { delegate, minConfidence, detectEveryMs } = settings
  useEffect(() => {
    let cancelled = false
    const started = performance.now()
    ;(async () => {
      try {
        const first = latest.current.settings
        let used: Delegate = delegate
        const detector = await createFaceDetector(delegate, first.minConfidence).catch(() => {
          if (delegate === 'CPU') throw new Error('CPU failed')
          used = 'CPU'
          return createFaceDetector('CPU', first.minConfidence)
        })
        if (cancelled) return detector.close()
        detectorRef.current = detector
        setModel({ status: 'ready', delegate: used, loadMs: Math.round(performance.now() - started) })
      } catch {
        if (!cancelled) setModel({ status: 'error', delegate: null, loadMs: null })
      }
    })()
    return () => {
      cancelled = true
      detectorRef.current?.close()
      detectorRef.current = null
      setModel({ status: 'loading', delegate: null, loadMs: null })
    }
  }, [delegate])

  // The confidence threshold can change on the running detector, no reload.
  useEffect(() => {
    void detectorRef.current?.setOptions({ minDetectionConfidence: minConfidence })
  }, [minConfidence, model.status])

  // 2. The loop: detect every `detectEveryMs`, send the best face every `windowMs`.
  useEffect(() => {
    let cancelled = false
    let windowStart = performance.now()
    let frames = 0
    let framesWithFace = 0
    let framesWithAnyFace = 0
    let detectMsTotal = 0
    let best: { score: number; box: BoundingBox; crop: HTMLCanvasElement; video: VideoSize } | null = null
    const resetWindow = (now: number) => {
      windowStart = now
      frames = framesWithFace = framesWithAnyFace = detectMsTotal = 0
      best = null
    }

    const tick = () => {
      const video = videoRef.current
      const detector = detectorRef.current
      if (!detector || !video || !video.videoWidth) return
      const { sending, settings: s } = latest.current

      const now = performance.now()
      const result = detector.detectForVideo(video, now)
      const detectMs = performance.now() - now
      const size = { width: video.videoWidth, height: video.videoHeight }
      const faces = result.detections.map((detection) => ({
        detection,
        closeEnough: isCloseEnough(detection, s.minFacePx),
      }))
      const face = bestDetection(faces.filter((f) => f.closeEnough).map((f) => f.detection))
      setLive({ faces, best: face, video: size, detectMs })

      if (!sending) return resetWindow(now)

      frames++
      detectMsTotal += detectMs
      if (faces.length) framesWithAnyFace++
      if (face?.boundingBox) {
        framesWithFace++
        // Crop now, from this exact frame. By the end of the window the person has moved.
        if (!best || scoreOf(face) > best.score) {
          best = { score: scoreOf(face), box: face.boundingBox, crop: cropFace(video, face.boundingBox, s.cropSize, s.cropMargin), video: size }
        }
      }

      if (now - windowStart < s.windowMs) return
      const shot = best
      const stats = { framesWithFace, frames, detectMs: detectMsTotal / Math.max(frames, 1) }
      const sawAnyFace = framesWithAnyFace > 0
      resetWindow(now)

      if (!shot) {
        if (sawAnyFace) latest.current.onSkip?.({ reason: 'too far', ...stats })
        return
      }
      if (stats.framesWithFace / stats.frames < s.minSteady) {
        latest.current.onSkip?.({ reason: 'not steady', ...stats })
        return
      }
      void toJpeg(shot.crop, s.jpegQuality).then((jpeg) => {
        if (jpeg && !cancelled && latest.current.sending) {
          latest.current.onShot({ jpeg, cropSize: shot.crop.width, score: shot.score, box: shot.box, video: shot.video, ...stats })
        }
      })
    }

    const timer = window.setInterval(tick, detectEveryMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [videoRef, detectEveryMs])

  return { live, model }
}
