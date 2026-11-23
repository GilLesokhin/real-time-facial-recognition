import { useEffect, useState, type SubmitEvent } from 'react'
import { Pencil, Search, Trash2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { ApiError } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { useStore } from '../../store/store'
import type { User, UserRole } from '../../types'

const ROLE_LABEL: Record<UserRole, string> = {
  unassigned: 'Unassigned',
  building_admin: 'Building Admin',
  platform_admin: 'Platform Admin',
}

// The API's own message for a refused change (e.g. 403 your own account, 404 already deleted, 422 no building).
const errorMessage = (err: unknown) => {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) return err.message
  return "Can't reach the server. Try again in a moment."
}

/** Platform Admin only: everyone who signed up, and what they can access. */
export function AdminsPage() {
  const { currentUser, isPlatformAdmin, visibleBuildings, listUsers, removeUser } = useStore()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [buildingFilter, setBuildingFilter] = useState('')
  // `users` follows the filters. `everyone` is unfiltered, for the counts in the header.
  const [users, setUsers] = useState<User[] | null>(null)
  const [everyone, setEveryone] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)
  // Bumped after a change, to load the lists again.
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  useEffect(() => {
    if (!isPlatformAdmin) return
    // Ignore an answer that arrives after the filters changed again.
    let cancelled = false
    const filters = { role: roleFilter || undefined, building: buildingFilter, search: query.trim() }
    Promise.all([listUsers(filters), listUsers()])
      .then(([filtered, all]) => {
        if (cancelled) return
        setUsers(filtered)
        setEveryone(all)
        setError(null)
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [isPlatformAdmin, listUsers, roleFilter, buildingFilter, query, version])

  if (!isPlatformAdmin) return <Navigate to="/" replace />

  const remove = (user: User) => {
    setError(null)
    removeUser(user.id)
      .then(reload)
      .catch((err) => setError(errorMessage(err)))
  }

  const unassignedCount = everyone.filter((u) => u.role === 'unassigned').length

  const buildingNames = (u: User) =>
    u.role === 'platform_admin'
      ? 'All buildings'
      : visibleBuildings.find((b) => b.id === u.building_id)?.name ?? '—'

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">Platform</span>
          <h1 className="title">Admins</h1>
          <p className="muted">
            {everyone.length} signed up{unassignedCount > 0 && ` · ${unassignedCount} unassigned`}
          </p>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <span className="visually-hidden">Search admins</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              maxLength={255}
            />
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
              {visibleBuildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="small error">{error}</p>}

      <div className="card table-wrap">
        {users === null ? (
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
                        <Avatar name={u.name} />
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
                    <td className={u.role === 'unassigned' ? 'faint' : 'muted'}>{buildingNames(u)}</td>
                    <td className="muted">{formatDate(u.created_at)}</td>
                    <td>
                      {/* You can't edit or delete your own account (that would lock you out). The API refuses it too. */}
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

      {editing && <AccessForm user={editing} onSaved={reload} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete account"
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        >
          Their account is deleted and they can no longer sign in. They can sign up again later.
        </ConfirmModal>
      )}
    </>
  )
}

/** Set a user's role and, for a Building Admin, their building. */
function AccessForm({ user, onSaved, onClose }: { user: User; onSaved: () => void; onClose: () => void }) {
  const { visibleBuildings, setUserAccess } = useStore()
  const [role, setRole] = useState<UserRole>(user.role)
  const [buildingId, setBuildingId] = useState(user.building_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const needsBuilding = role === 'building_admin' && !buildingId

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (needsBuilding) return
    setPending(true)
    setError(null)
    try {
      await setUserAccess(user, role, buildingId || null)
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit}>
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
              <option value="">Pick a building</option>
              {visibleBuildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {needsBuilding && <span className="small error">Pick a building.</span>}
          </label>
        )}
        {role === 'platform_admin' && (
          <p className="small faint">A Platform Admin sees and manages every building, including this Admins page.</p>
        )}
        {role === 'unassigned' && (
          <p className="small faint">Unassigned users have an account but can't sign in to the admin panel.</p>
        )}

        {error && <p className="small error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={needsBuilding || pending}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
