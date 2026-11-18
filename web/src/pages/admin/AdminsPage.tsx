import { useState } from 'react'
import { Pencil, Search, Trash2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { useApi } from '../../hooks/useApi'
import { api, errorMessage } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { useStore } from '../../store/store'
import type { User, UserRole } from '../../types'

const ROLE_LABEL: Record<UserRole, string> = {
  unassigned: 'Unassigned',
  building_admin: 'Building Admin',
  platform_admin: 'Platform Admin',
}

/** Platform Admin only: everyone who signed up, and what they can access. */
export function AdminsPage() {
  const { visibleBuildings: buildings, currentUser, isPlatformAdmin } = useStore()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  const params = new URLSearchParams()
  if (roleFilter) params.set('role', roleFilter)
  if (buildingFilter) params.set('building', buildingFilter)
  if (query.trim()) params.set('q', query.trim())
  // The API sorts: unassigned first (they need a decision), then by name.
  const { data: users, error, reload } = useApi<User[]>(isPlatformAdmin ? `/users?${params}` : null)

  if (!isPlatformAdmin) return <Navigate to="/" replace />

  const buildingName = (u: User) =>
    u.role === 'platform_admin' ? 'All buildings' : (buildings.find((b) => b.id === u.building_id)?.name ?? '—')

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">Platform</span>
          <h1 className="title">Admins</h1>
          <p className="muted">Everyone who signed up. Give new accounts a role so they can sign in.</p>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <span className="visually-hidden">Search admins</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" />
          </label>
          <label className="field">
            <span className="label">Role</span>
            <select
              className="select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            >
              <option value="">All roles</option>
              <option value="unassigned">Unassigned</option>
              <option value="building_admin">Building Admin</option>
              <option value="platform_admin">Platform Admin</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Building</span>
            <select className="select" value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
              <option value="">All buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card table-wrap">
        {error ? (
          <p className="empty error">{error}</p>
        ) : !users ? (
          <p className="empty muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="empty muted">No matches.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className="label">User</th>
                <th className="label">Role</th>
                <th className="label">Building</th>
                <th className="label">Signed up</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-row">
                        <Avatar name={u.name} photo={null} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>
                            {u.name} {isSelf && <span className="small faint">(you)</span>}
                          </span>
                          <span className="small faint">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-role-${u.role}`}>{ROLE_LABEL[u.role]}</span>
                    </td>
                    <td className={u.role === 'unassigned' ? 'faint' : 'muted'}>{buildingName(u)}</td>
                    <td className="muted">{formatDate(u.created_at)}</td>
                    <td>
                      {/* You can't edit or delete your own account (that would lock you out). */}
                      {!isSelf && (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Edit ${u.name}`}
                            onClick={() => setEditing(u)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label={`Delete ${u.name}`}
                            onClick={() => setDeleting(u)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && <AccessForm user={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete account"
          onConfirm={async () => {
            await api(`/users/${deleting.id}`, { method: 'DELETE' })
            reload()
          }}
          onClose={() => setDeleting(null)}
        >
          Their account is deleted and they can no longer sign in. They can sign up again later.
        </ConfirmModal>
      )}
    </>
  )
}

/** Set a user's role and, for a Building Admin, their one building. */
function AccessForm({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const { visibleBuildings: buildings } = useStore()
  const [role, setRole] = useState<UserRole>(user.role)
  const [buildingId, setBuildingId] = useState(user.building_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const needsBuilding = role === 'building_admin' && !buildingId

  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose} wide>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault()
          if (needsBuilding) return
          setSaving(true)
          try {
            const body = { role, building_id: role === 'building_admin' ? buildingId : null }
            await api(`/users/${user.id}`, { method: 'PATCH', body })
            onSaved()
            onClose()
          } catch (err) {
            setError(errorMessage(err))
            setSaving(false)
          }
        }}
      >
        <p className="muted">{user.email}</p>
        <label className="field">
          <span className="label">Role</span>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="unassigned">Unassigned</option>
            <option value="building_admin">Building Admin</option>
            <option value="platform_admin">Platform Admin</option>
          </select>
        </label>

        {role === 'building_admin' && (
          <label className="field">
            <span className="label">Building</span>
            <select className="select" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
              <option value="">Choose a building</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {role === 'platform_admin' && (
          <p className="small faint">A Platform Admin sees and manages every building, including this Admins page.</p>
        )}
        {role === 'unassigned' && (
          <p className="small faint">Unassigned users have an account but can't sign in to the admin panel.</p>
        )}

        <div className="form-actions">
          {error && (
            <p className="error small" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              {error}
            </p>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={needsBuilding || saving}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
