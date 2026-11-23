import { useEffect, useRef, useState } from 'react'
import { Camera, ImageUp, Trash2, User } from 'lucide-react'
import { useCamera } from '../hooks/useCamera'
import { createFaceDetector, enrollmentCrop, grabFrame, toJpeg, type FaceDetector } from '../lib/face/detector'

interface PhotoPickerProps {
  /** The face crop JPEG to send, or null when none is picked. Only this picker changes it. */
  value: Blob | null
  onChange: (photo: Blob | null) => void
  hint?: string
}

/**
 * BlazeFace in IMAGE mode, for one still image at a time. GPU first, CPU if that fails.
 * The same model the door runs, so enrollment and door crops match.
 */
function useStillFaceDetector() {
  const [detector, setDetector] = useState<FaceDetector | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let created: FaceDetector | null = null
    createFaceDetector('GPU', undefined, 'IMAGE')
      .catch(() => createFaceDetector('CPU', undefined, 'IMAGE'))
      .then((d) => {
        if (cancelled) return d.close()
        created = d
        setDetector(d)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      created?.close()
    }
  }, [])

  return { detector, failed }
}

function WebcamCapture({
  detector,
  onCapture,
  onCancel,
}: {
  detector: FaceDetector
  onCapture: (photo: Blob, original: Blob) => void
  onCancel: () => void
}) {
  const { videoRef, status } = useCamera()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const capture = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setBusy(true)
    try {
      const frame = grabFrame(video)
      const photo = await enrollmentCrop(detector, frame)
      // The whole frame, to show after capture. Only the crop is sent to the server.
      const original = await toJpeg(frame)
      onCapture(photo, original ?? photo)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="photo-row">
      <div className="photo-frame">
        <video ref={videoRef} muted playsInline />
        {status !== 'live' && (
          <span className="small faint" style={{ position: 'absolute' }}>
            {status === 'starting' ? 'Starting camera…' : 'Camera unavailable'}
          </span>
        )}
      </div>
      <div className="photo-buttons">
        <button type="button" className="btn btn-primary" disabled={status !== 'live' || busy} onClick={capture}>
          <Camera size={16} /> Capture
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className="small error photo-hint">{error}</p>}
      <p className="small faint photo-hint">Face the camera, one person only, good light.</p>
    </div>
  )
}

/** Picks a face photo from the webcam or a file, and turns it into the face crop the server embeds. */
export function PhotoPicker({ value, onChange, hint = 'A clear, front-facing photo of one face.' }: PhotoPickerProps) {
  const { detector, failed } = useStillFaceDetector()
  // A URL to show the picked photo. Made where the photo is picked, and freed when it's replaced or the picker closes.
  const [preview, setPreview] = useState<string | null>(null)
  // A webcam photo is shown mirrored, like the live camera. An uploaded photo is shown as it is.
  const [fromWebcam, setFromWebcam] = useState(false)
  const previewRef = useRef<string | null>(null)
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
  }, [])
  /**
   * `photo` is the crop sent to the server, or null to clear it. `shown` is what the frame shows:
   * the whole webcam frame, or the crop itself. `webcam` shows it mirrored.
   */
  const pick = ({ photo, shown = photo, webcam = false }: { photo: Blob | null; shown?: Blob | null; webcam?: boolean }) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = shown ? URL.createObjectURL(shown) : null
    setPreview(previewRef.current)
    setFromWebcam(webcam)
    onChange(photo)
  }
  const [usingCamera, setUsingCamera] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (usingCamera && detector) {
    return (
      <WebcamCapture
        detector={detector}
        onCapture={(photo, original) => {
          pick({ photo, shown: original, webcam: true })
          setError(null)
          setUsingCamera(false)
        }}
        onCancel={() => setUsingCamera(false)}
      />
    )
  }

  const upload = async (file: File) => {
    if (!detector) return
    setBusy(true)
    let image: ImageBitmap | null = null
    try {
      // Turns the photo upright from its EXIF data, as a phone camera intended.
      image = await createImageBitmap(file).catch(() => {
        throw new Error("Couldn't read that image.")
      })
      pick({ photo: await enrollmentCrop(detector, image) })
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      image?.close()
      setBusy(false)
    }
  }

  const ready = !!detector && !busy

  return (
    <div className="photo-row">
      <div className="photo-frame">
        {preview ? (
          <img src={preview} alt="Face photo" className={fromWebcam ? 'mirrored' : undefined} />
        ) : (
          <User size={64} strokeWidth={1} />
        )}
        {value && (
          <button type="button" className="icon-btn danger" aria-label="Remove photo" onClick={() => pick({ photo: null })}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="photo-buttons">
        <button type="button" className="btn" disabled={!ready} onClick={() => setUsingCamera(true)}>
          <Camera size={20} /> Take with webcam
        </button>
        <button type="button" className="btn" disabled={!ready} onClick={() => fileInput.current?.click()}>
          <ImageUp size={20} /> Upload photo
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
      </div>
      {failed && <p className="small error photo-hint">The face detector didn't load. Reload the page.</p>}
      {!detector && !failed && <p className="small faint photo-hint">Loading the face detector…</p>}
      {error && <p className="small error photo-hint">{error}</p>}
      <p className="small faint photo-hint">{hint}</p>
    </div>
  )
}
