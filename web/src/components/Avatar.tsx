import { initials } from '../lib/format'

export function Avatar({ name, photo, size = 40 }: { name: string; photo: string | null; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {photo ? <img src={photo} alt="" /> : initials(name)}
    </div>
  )
}
