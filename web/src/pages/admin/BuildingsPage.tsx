import { useState, type SubmitEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { ApiError } from '../../lib/api'
import { useStore } from '../../store/store'
import type { Building } from '../../types'

type Dialog = { kind: 'add' } | { kind: 'edit' | 'remove'; building: Building }

const errorMessage = (err: unknown) => {
  if (err instanceof ApiError && err.status === 409) return err.message
  if (err instanceof ApiError && err.status === 404) return 'This building no longer exists. Reload the page.'
  return "Can't reach the server. Try again in a moment."
}

/** Every admin sees the buildings they can reach. Only a Platform Admin can add, edit or delete. */
export function BuildingsPage() {
  const { visibleBuildings, isPlatformAdmin, removeBuilding } = useStore()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const close = () => setDialog(null)

  const remove = (building: Building) => {
    setError(null)
    removeBuilding(building.id).catch((err) => setError(errorMessage(err)))
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">{isPlatformAdmin ? 'Platform' : 'Your building'}</span>
          <h1 className="title">Buildings</h1>
          <p className="muted">{visibleBuildings.length} buildings</p>
        </div>
        {isPlatformAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'add' })}>
            <Plus size={16} /> Add building
          </button>
        )}
      </div>

      {error && <p className="small error">{error}</p>}

      <div className="card table-wrap">
        {visibleBuildings.length === 0 ? (
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
              {visibleBuildings.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td className={b.address ? 'muted' : 'faint'}>{b.address || '—'}</td>
                  <td>
                    {isPlatformAdmin && (
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
                    )}
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
          onConfirm={() => remove(dialog.building)}
          onClose={close}
        >
          Its terminals stop opening the door and its people are no longer recognized. Its Building Admins lose access.
        </ConfirmModal>
      )}
    </>
  )
}

function BuildingForm({ building, onClose }: { building?: Building; onClose: () => void }) {
  const { addBuilding, updateBuilding } = useStore()
  const [name, setName] = useState(building?.name ?? '')
  const [address, setAddress] = useState(building?.address ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return
    setPending(true)
    setError(null)
    try {
      if (building) await updateBuilding({ ...building, name: name.trim(), address: address.trim() })
      else await addBuilding(name.trim(), address.trim())
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title={building ? 'Edit building' : 'Add building'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} autoFocus />
        </label>
        <label className="field">
          <span className="label">Address</span>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={255} />
        </label>
        {!building && (
          <p className="small faint">Next, add its terminals and people, and give a Building Admin access on the Admins page.</p>
        )}
        {error && <p className="small error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || pending}>
            {building ? 'Save' : 'Add building'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
