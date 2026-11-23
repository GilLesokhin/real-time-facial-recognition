import { initials } from '../lib/format'

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {initials(name)}
    </div>
  )
}
