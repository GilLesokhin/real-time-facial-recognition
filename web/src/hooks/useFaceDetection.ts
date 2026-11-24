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

/** The best face of the latest frames, ready to send. */
export interface FaceShot {
  jpeg: Blob
  cropSize: number
  score: number
  /** In video pixels, unmirrored. */
  box: BoundingBox
  video: VideoSize
  /** Frames with a usable face, out of the latest frames looked at. */
  framesWithFace: number
  frames: number
  /** Average time one detection took over those frames. */
  detectMs: number
}

interface Options {
  /** While false, faces are still tracked for the box, but nothing is handed over. */
  sending: boolean
  /** Called with the best face once `minGoodFrames` of the latest `windowFrames` frames have one. */
  onShot: (shot: FaceShot) => void
  settings?: DetectionSettings
}

/** One frame in the rolling list. `face` is null when the frame had no usable face. */
interface Frame {
  face: { score: number; box: BoundingBox; crop: HTMLCanvasElement; video: VideoSize } | null
  detectMs: number
}

/**
 * Runs the face detector on the camera every `detectEveryMs`. Returns what the latest frame shows
 * (for drawing). Keeps the latest `windowFrames` frames, and as soon as `minGoodFrames` of them have
 * a usable face, hands the best one to `onShot` and starts the list again.
 */
export function useFaceDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  { sending, onShot, settings = DEFAULT_SETTINGS }: Options,
) {
  const [live, setLive] = useState<LiveFrame | null>(null)
  const [model, setModel] = useState<{ status: 'loading' | 'ready' | 'error'; delegate: Delegate | null; loadMs: number | null }>(
    { status: 'loading', delegate: null, loadMs: null },
  )
  const detectorRef = useRef<FaceDetector | null>(null)

  // The loop reads the latest props through refs, so changing a setting doesn't restart it.
  const latest = useRef({ sending, onShot, settings })
  useEffect(() => {
    latest.current = { sending, onShot, settings }
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

  // 2. The loop: detect every `detectEveryMs`, send once enough of the latest frames have a face.
  useEffect(() => {
    let cancelled = false
    let frames: Frame[] = []

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

      if (!sending) {
        frames = []
        return
      }

      // Crop now, from this exact frame. A few frames later the person has moved.
      const usable = face?.boundingBox
        ? { score: scoreOf(face), box: face.boundingBox, crop: cropFace(video, face.boundingBox, s.cropSize, s.cropMargin), video: size }
        : null
      frames = [...frames, { face: usable, detectMs }].slice(-s.windowFrames)

      const good = frames.flatMap((f) => (f.face ? [f.face] : []))
      if (good.length < s.minGoodFrames) return
      const shot = good.reduce((best, f) => (f.score > best.score ? f : best))
      const stats = {
        framesWithFace: good.length,
        frames: frames.length,
        detectMs: frames.reduce((sum, f) => sum + f.detectMs, 0) / frames.length,
      }
      frames = []

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
