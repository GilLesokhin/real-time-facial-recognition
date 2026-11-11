import { useEffect, useRef, useState } from 'react'

export type CameraStatus = 'starting' | 'live' | 'unavailable'

/** Streams the computer's webcam into a <video>. Stops the camera on unmount. The size is a wish; the camera picks the closest it has. */
export function useCamera({ width = 1280, height = 720 }: { width?: number; height?: number } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<CameraStatus>(() =>
    typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'starting' : 'unavailable',
  )

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return
    let stream: MediaStream | null = null
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: width }, height: { ideal: height }, facingMode: 'user' }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          void videoRef.current.play()
        }
        setStatus('live')
      })
      .catch(() => !cancelled && setStatus('unavailable'))

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [width, height])

  /** Grabs the current frame as a JPEG data URL, mirrored: the convention for all face images (see detector.ts). */
  const capture = (maxWidth = 480): string | null => {
    const video = videoRef.current
    if (!video || status !== 'live' || !video.videoWidth) return null
    const scale = Math.min(1, maxWidth / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  return { videoRef, status, capture }
}
