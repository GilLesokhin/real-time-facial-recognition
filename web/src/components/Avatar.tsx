import { useState } from 'react'
import { initials } from '../lib/format'

/** The photo, or the person's initials when there's none or it fails to load (e.g. a removed person). */
export function Avatar({ name, photo, size = 40 }: { name: string; photo: string | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  const showPhoto = photo && failed !== photo
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {showPhoto ? <img src={photo} alt="" onError={() => setFailed(photo)} /> : initials(name)}
    </div>
  )
}
