import { useEffect, useRef, useState } from 'react'

export type CameraStatus = 'starting' | 'live' | 'unavailable'

/**
 * Streams the computer's webcam into a <video>. Stops the camera on unmount.
 * The size is a wish: the camera picks the closest it has, in any aspect ratio. A bigger frame keeps
 * more detail in a face that stands further away.
 */
export function useCamera({ width = 1920, height = 1080 }: { width?: number; height?: number } = {}) {
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

  return { videoRef, status }
}
