import { useState, type SubmitEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Modal } from '../../components/Modal'
import { PhotoPicker } from '../../components/PhotoPicker'
import { useCurrentBuilding, useStore } from '../../store/store'

/** Add / edit person, shown as a popup over the People list (nested route). */
export function PersonFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, addPerson, updatePerson } = useStore()
  const building = useCurrentBuilding()
  const existing = id ? state.people.find((p) => p.id === id && p.building_id === building.id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [unit, setUnit] = useState(existing?.unit ?? '')
  const [photo, setPhoto] = useState<string | null>(existing?.photo ?? null)
  const [error, setError] = useState<string | null>(null)

  const close = () => navigate(`/buildings/${building.id}/people`)

  if (id && !existing) {
    return (
      <Modal title="Person" onClose={close}>
        <p className="muted">That person no longer exists.</p>
      </Modal>
    )
  }

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return setError('Enter a name.')
    if (!photo) return setError('Add a face photo. The terminal matches against it.')
    const fields = { name: name.trim(), unit: unit.trim(), photo }
    if (existing) updatePerson({ ...existing, ...fields })
    else addPerson({ ...fields, building_id: building.id })
    close()
  }

  return (
    <Modal title={existing ? `Edit ${existing.name}` : `Add person · ${building.name}`} onClose={close} wide>
      <form className="form-grid" onSubmit={onSubmit} noValidate>
        <section className="form-block">
          <label className="field">
            <span className="label">Full name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="label">Unit</span>
            <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Apt 4B" />
          </label>
        </section>

        <section className="form-block">
          <div className="field">
            <span className="label">Photo</span>
            <PhotoPicker value={photo} onChange={setPhoto} />
          </div>
        </section>

        <div className="form-actions">
          {error && (
            <p className="error small" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              {error}
            </p>
          )}
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {existing ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
