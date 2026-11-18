import { useState, type SubmitEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { api, errorMessage } from '../../lib/api'
import { useStore } from '../../store/store'
import type { Building } from '../../types'

type Dialog = { kind: 'add' } | { kind: 'edit' | 'remove'; building: Building }

/** Platform Admin only. Admins and terminals are managed from People and Terminals. */
export function BuildingsPage() {
  const { visibleBuildings: buildings, isPlatformAdmin, reloadBuildings } = useStore()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  if (!isPlatformAdmin) return <Navigate to="/" replace />

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">Platform</span>
          <h1 className="title">Buildings</h1>
          <p className="muted">{buildings.length === 1 ? '1 building' : `${buildings.length} buildings`}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'add' })}>
          <Plus size={16} /> Add building
        </button>
      </div>

      <div className="card table-wrap">
        {buildings.length === 0 ? (
          <p className="empty muted">No buildings yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className="label">Building</th>
                <th className="label">Address</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td className={b.address ? 'muted' : 'faint'}>{b.address || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${b.name}`}
                        onClick={() => setDialog({ kind: 'edit', building: b })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Delete ${b.name}`}
                        onClick={() => setDialog({ kind: 'remove', building: b })}
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

      {dialog?.kind === 'add' && <BuildingForm onClose={close} />}
      {dialog?.kind === 'edit' && <BuildingForm building={dialog.building} onClose={close} />}
      {dialog?.kind === 'remove' && (
        <ConfirmModal
          title={`Delete ${dialog.building.name}?`}
          confirmLabel="Delete building"
          onConfirm={async () => {
            await api(`/buildings/${dialog.building.id}`, { method: 'DELETE' })
            reloadBuildings()
          }}
          onClose={close}
        >
          Its people and terminals stop working, and the doors no longer open. The access log is kept.
        </ConfirmModal>
      )}
    </>
  )
}

function BuildingForm({ building, onClose }: { building?: Building; onClose: () => void }) {
  const { reloadBuildings } = useStore()
  const [name, setName] = useState(building?.name ?? '')
  const [address, setAddress] = useState(building?.address ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const body = { name: name.trim(), address: address.trim() }
      if (building) await api(`/buildings/${building.id}`, { method: 'PATCH', body })
      else await api('/buildings', { method: 'POST', body })
      reloadBuildings()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={building ? 'Edit building' : 'Add building'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span className="label">Address</span>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        {!building && (
          <p className="small faint">Next, add its terminals and people, and give a Building Admin access on the Admins page.</p>
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
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || saving}>
            {building ? 'Save' : 'Add building'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
