import { useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { ConfirmModal } from '../../components/ConfirmModal'
import { formatDate } from '../../lib/format'
import { useStore } from '../../store/store'
import type { Person } from '../../types'

export function PeoplePage() {
  const { state, currentBuilding, removePerson } = useStore()
  const [query, setQuery] = useState('')
  const [toRemove, setToRemove] = useState<Person | null>(null)

  if (!currentBuilding) {
    return <p className="card empty muted">No building selected.</p>
  }

  const people = state.people.filter((p) => p.buildingId === currentBuilding.id)
  const q = query.trim().toLowerCase()
  const shown = q ? people.filter((p) => `${p.name} ${p.unit}`.toLowerCase().includes(q)) : people

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">{currentBuilding.name}</span>
          <h1 className="title">People</h1>
          <p className="muted">{people.length} allowed to enter</p>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <span className="visually-hidden">Search people</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or unit" />
          </label>
          <Link to="/admin/people/new" className="btn btn-primary">
            <Plus size={16} /> Add person
          </Link>
        </div>
      </div>

      <div className="card table-wrap">
        {shown.length === 0 ? (
          <p className="empty muted">{people.length === 0 ? 'No people yet. Add the first one.' : 'No matches.'}</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className="label">Person</th>
                <th className="label">Unit</th>
                <th className="label">Face photo</th>
                <th className="label">Added</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-row">
                      <Avatar name={p.name} photo={p.photo} />
                      {p.name}
                    </div>
                  </td>
                  <td className="muted">{p.unit}</td>
                  <td className={p.photo ? 'muted' : 'faint'}>{p.photo ? 'On file' : 'Missing'}</td>
                  <td className="muted">{formatDate(p.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Link to={`/admin/people/${p.id}/edit`} className="icon-btn" aria-label={`Edit ${p.name}`}>
                        <Pencil size={16} />
                      </Link>
                                            <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => setToRemove(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Outlet />

      {toRemove && (
        <ConfirmModal
          title={`Remove ${toRemove.name}?`}
          confirmLabel="Remove"
          onConfirm={() => removePerson(toRemove.id)}
          onClose={() => setToRemove(null)}
        >
          They will no longer be able to enter {currentBuilding.name}. Their face photo is deleted too.
        </ConfirmModal>
      )}
    </>
  )
}
