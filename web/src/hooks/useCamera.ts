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
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return
    let started: MediaStream | null = null
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: width }, height: { ideal: height }, facingMode: 'user' }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        started = s
        setStream(s)
        setStatus('live')
      })
      .catch(() => !cancelled && setStatus('unavailable'))

    return () => {
      cancelled = true
      started?.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
  }, [width, height])

  // After every render: the page may show its <video> only later (the terminal waits for its key),
  // so connect the stream whenever the video and the stream are both there.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream || video.srcObject === stream) return
    video.srcObject = stream
    void video.play()
  })

  return { videoRef, status }
}
