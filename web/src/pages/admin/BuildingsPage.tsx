import { useState, type SubmitEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { useStore } from '../../store/store'
import type { Building } from '../../types'

type Dialog = { kind: 'add' } | { kind: 'edit' | 'remove'; building: Building }

/** Platform Admin only. Admins and terminals are managed from People and Terminals. */
export function BuildingsPage() {
  const { state, isPlatformAdmin, removeBuilding } = useStore()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  if (!isPlatformAdmin) return <Navigate to="/" replace />

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">Platform</span>
          <h1 className="title">Buildings</h1>
          <p className="muted">{state.buildings.length} buildings</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'add' })}>
          <Plus size={16} /> Add building
        </button>
      </div>

      <div className="card table-wrap">
        {state.buildings.length === 0 ? (
          <p className="empty muted">No buildings yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className="label">Building</th>
                <th className="label">Building Admins</th>
                <th className="label">People</th>
                <th className="label">Terminals</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.buildings.map((b) => {
                const people = state.people.filter((p) => p.building_id === b.id)
                const admins = state.users.filter((u) => u.role === 'building_admin' && u.building_ids.includes(b.id))
                const terminals = state.terminals.filter((t) => t.building_id === b.id).length
                return (
                  <tr key={b.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {b.name}
                        <span className="small faint">{b.address}</span>
                      </div>
                    </td>
                    <td className={admins.length ? 'muted' : 'faint'}>
                      {admins.length ? admins.map((a) => a.name).join(', ') : 'None'}
                    </td>
                    <td className="muted">{people.length}</td>
                    <td className="muted">{terminals}</td>
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
                )
              })}
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
          onConfirm={() => removeBuilding(dialog.building.id)}
          onClose={close}
        >
          This deletes its people, face photos, terminals and access log. It can't be undone.
        </ConfirmModal>
      )}
    </>
  )
}

function BuildingForm({ building, onClose }: { building?: Building; onClose: () => void }) {
  const { addBuilding, updateBuilding } = useStore()
  const [name, setName] = useState(building?.name ?? '')
  const [address, setAddress] = useState(building?.address ?? '')

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return
    if (building) updateBuilding({ ...building, name: name.trim(), address: address.trim() })
    else addBuilding(name.trim(), address.trim())
    onClose()
  }

  return (
    <Modal title={building ? "Edit building" : "Add building"} onClose={onClose} wide>
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
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {building ? 'Save' : 'Add building'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
