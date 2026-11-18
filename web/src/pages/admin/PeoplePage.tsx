import { useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { ConfirmModal } from '../../components/ConfirmModal'
import { useApi } from '../../hooks/useApi'
import { api, personPhotoUrl } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { useCurrentBuilding } from '../../store/store'
import type { Person } from '../../types'

/** What the add / edit popup (nested route) gets from this page. */
export interface PeopleContext {
  people: Person[] | null
  reload: () => void
}

export function PeoplePage() {
  const currentBuilding = useCurrentBuilding()
  const [query, setQuery] = useState('')
  const q = query.trim()
  const path = `/buildings/${currentBuilding.id}/people${q ? `?q=${encodeURIComponent(q)}` : ''}`
  const { data: people, error, reload } = useApi<Person[]>(path)
  const [toRemove, setToRemove] = useState<Person | null>(null)

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">{currentBuilding.name}</span>
          <h1 className="title">People</h1>
          <p className="muted">{people && !q ? `${people.length} allowed to enter` : 'Allowed to enter'}</p>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <span className="visually-hidden">Search people</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or apartment" />
          </label>
          <Link to="new" className="btn btn-primary">
            <Plus size={16} /> Add person
          </Link>
        </div>
      </div>

      <div className="card table-wrap">
        {error ? (
          <p className="empty error">{error}</p>
        ) : !people ? (
          <p className="empty muted">Loading…</p>
        ) : people.length === 0 ? (
          <p className="empty muted">{q ? 'No matches.' : 'No people yet. Add the first one.'}</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className="label">Person</th>
                <th className="label">Apartment</th>
                <th className="label">Added</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-row">
                      <Avatar name={p.name} photo={personPhotoUrl(p.id)} />
                      {p.name}
                    </div>
                  </td>
                  <td className={p.apartment ? 'muted' : 'faint'}>{p.apartment || '—'}</td>
                  <td className="muted">{formatDate(p.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <Link to={`${p.id}/edit`} className="icon-btn" aria-label={`Edit ${p.name}`}>
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

      <Outlet context={{ people, reload } satisfies PeopleContext} />

      {toRemove && (
        <ConfirmModal
          title={`Remove ${toRemove.name}?`}
          confirmLabel="Remove"
          onConfirm={async () => {
            await api(`/people/${toRemove.id}`, { method: 'DELETE' })
            reload()
          }}
          onClose={() => setToRemove(null)}
        >
          They will no longer be able to enter {currentBuilding.name}. Their past checks stay in the access log.
        </ConfirmModal>
      )}
    </>
  )
}
