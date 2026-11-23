import { useEffect, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Avatar } from '../../components/Avatar'
import { ConfirmModal } from '../../components/ConfirmModal'
import { ApiError } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { useCurrentBuilding, useStore } from '../../store/store'
import type { Person } from '../../types'
import type { PeopleOutlet } from './peopleOutlet'

const errorMessage = (err: unknown) => {
  if (err instanceof ApiError && err.status === 404) return 'This person no longer exists. Reload the page.'
  return "Can't reach the server. Try again in a moment."
}

export function PeoplePage() {
  const { listPeople, removePerson } = useStore()
  const currentBuilding = useCurrentBuilding()
  const [query, setQuery] = useState('')
  // `people` follows the search. `everyone` is unsearched, for the count and the edit popup.
  const [people, setPeople] = useState<Person[] | null>(null)
  const [everyone, setEveryone] = useState<Person[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped after a change, to load the lists again.
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)
  const [toRemove, setToRemove] = useState<Person | null>(null)

  useEffect(() => {
    // Ignore an answer that arrives after the search or the building changed.
    let cancelled = false
    Promise.all([listPeople(currentBuilding.id, query), listPeople(currentBuilding.id)])
      .then(([found, all]) => {
        if (cancelled) return
        setPeople(found)
        setEveryone(all)
        setError(null)
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [listPeople, currentBuilding.id, query, version])

  const remove = (person: Person) => {
    setError(null)
    removePerson(person.id)
      .then(reload)
      .catch((err) => setError(errorMessage(err)))
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">{currentBuilding.name}</span>
          <h1 className="title">People</h1>
          <p className="muted">{everyone ? `${everyone.length} allowed to enter` : 'Loading…'}</p>
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

      {error && <p className="error small">{error}</p>}

      <div className="card table-wrap">
        {people === null ? (
          <p className="empty muted">Loading…</p>
        ) : people.length === 0 ? (
          <p className="empty muted">{everyone?.length === 0 ? 'No people yet. Add the first one.' : 'No matches.'}</p>
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
                      <Avatar name={p.name} />
                      {p.name}
                    </div>
                  </td>
                  <td className="muted">{p.apartment}</td>
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

      <Outlet context={{ everyone, reload } satisfies PeopleOutlet} />

      {toRemove && (
        <ConfirmModal
          title={`Remove ${toRemove.name}?`}
          confirmLabel="Remove"
          onConfirm={() => remove(toRemove)}
          onClose={() => setToRemove(null)}
        >
          They will no longer be able to enter {currentBuilding.name}.
        </ConfirmModal>
      )}
    </>
  )
}
