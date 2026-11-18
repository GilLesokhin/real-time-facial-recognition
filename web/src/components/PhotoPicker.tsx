import { useRef, useState } from 'react'
import { Camera, ImageUp, Trash2, User } from 'lucide-react'
import { useCamera } from '../hooks/useCamera'
import { mirroredCanvas } from '../lib/face/detector'

interface PhotoPickerProps {
  value: string | null
  onChange: (photo: string | null) => void
}

/**
 * Shrinks an uploaded image, so the upload stays small, and mirrors it like every other face
 * image the server sees (see the orientation rule in lib/face/detector.ts).
 */
function resizeImage(file: File, maxWidth = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = mirroredCanvas(img, maxWidth)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

function WebcamCapture({ onCapture, onCancel }: { onCapture: (photo: string) => void; onCancel: () => void }) {
  const { videoRef, status, capture } = useCamera()
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
        <button
          type="button"
          className="btn btn-primary"
          disabled={status !== 'live'}
          onClick={() => {
            const photo = capture()
            if (photo) onCapture(photo)
          }}
        >
          <Camera size={16} /> Capture
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="small faint photo-hint">Face the camera, one person only, good light.</p>
    </div>
  )
}

export function PhotoPicker({ value, onChange }: PhotoPickerProps) {
  const [usingCamera, setUsingCamera] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  if (usingCamera) {
    return (
      <WebcamCapture
        onCapture={(photo) => {
          onChange(photo)
          setUsingCamera(false)
        }}
        onCancel={() => setUsingCamera(false)}
      />
    )
  }

  return (
    <div className="photo-row">
      <div className="photo-frame">
        {value ? <img src={value} alt="Face photo" /> : <User size={64} strokeWidth={1} />}
        {value && (
          <button type="button" className="icon-btn danger" aria-label="Remove photo" onClick={() => onChange(null)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="photo-buttons">
        <button type="button" className="btn" onClick={() => setUsingCamera(true)}>
          <Camera size={20} /> Take with webcam
        </button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          <ImageUp size={20} /> Upload photo
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              onChange(await resizeImage(file))
              setError(null)
            } catch (err) {
              setError((err as Error).message)
            }
          }}
        />
      </div>
      {error && <p className="small error photo-hint">{error}</p>}
      <p className="small faint photo-hint">A clear, front-facing photo of one face.</p>
    </div>
  )
}
