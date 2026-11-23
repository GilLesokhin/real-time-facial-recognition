import { useState, type SubmitEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Modal } from '../../components/Modal'
import { PhotoPicker } from '../../components/PhotoPicker'
import { ApiError } from '../../lib/api'
import { useCurrentBuilding, useStore } from '../../store/store'
import type { Person } from '../../types'
import { usePeopleOutlet } from './peopleOutlet'

const errorMessage = (err: unknown) => {
  // 413 (photo over 1 MB) and 422 (no face, more than one face) carry a message for the admin.
  if (err instanceof ApiError && (err.status === 413 || err.status === 422)) return err.message
  if (err instanceof ApiError && err.status === 404) return 'This person no longer exists. Reload the page.'
  return "Can't reach the server. Try again in a moment."
}

/** Add / edit person, shown as a popup over the People list (nested route). */
export function PersonFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const building = useCurrentBuilding()
  const { everyone } = usePeopleOutlet()
  const close = () => navigate(`/buildings/${building.id}/people`)

  if (!id) return <PersonForm building={building} onClose={close} />
  if (everyone === null) {
    return (
      <Modal title="Person" onClose={close}>
        <p className="muted">Loading…</p>
      </Modal>
    )
  }
  const existing = everyone.find((p) => p.id === id)
  if (!existing) {
    return (
      <Modal title="Person" onClose={close}>
        <p className="muted">That person no longer exists.</p>
      </Modal>
    )
  }
  return <PersonForm building={building} existing={existing} onClose={close} />
}

function PersonForm({
  building,
  existing,
  onClose,
}: {
  building: { id: string; name: string }
  existing?: Person
  onClose: () => void
}) {
  const { addPerson, updatePerson } = useStore()
  const { reload } = usePeopleOutlet()
  const [name, setName] = useState(existing?.name ?? '')
  const [apartment, setApartment] = useState(existing?.apartment ?? '')
  // A new face crop. When editing, null keeps the current face.
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fields = { name: name.trim(), apartment: apartment.trim() }
    if (!fields.name) return setError('Enter a name.')
    if (!fields.apartment) return setError('Enter an apartment.')
    if (!existing && !photo) return setError('Add a face photo. The terminal matches against it.')

    setSaving(true)
    setError(null)
    try {
      if (existing) await updatePerson(existing.id, fields, photo)
      else await addPerson(building.id, fields, photo!)
      reload()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={existing ? `Edit ${existing.name}` : `Add person · ${building.name}`} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit} noValidate>
        <section className="form-block">
          <label className="field">
            <span className="label">Full name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="label">Apartment</span>
            <input className="input" value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="4B" />
          </label>
        </section>

        <section className="form-block">
          <div className="field">
            <span className="label">Photo</span>
            <PhotoPicker
              value={photo}
              onChange={setPhoto}
              hint={
                existing
                  ? 'Add a new photo only to replace their face. No photos are stored.'
                  : 'A clear, front-facing photo of one face. Only the face data is kept, not the photo.'
              }
            />
          </div>
        </section>

        <div className="form-actions">
          {error && (
            <p className="error small" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              {error}
            </p>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
