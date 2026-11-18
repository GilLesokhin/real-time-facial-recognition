import { useState, type SubmitEvent } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Modal } from '../../components/Modal'
import { PhotoPicker } from '../../components/PhotoPicker'
import { api, dataUrlToBlob, errorMessage, personPhotoUrl } from '../../lib/api'
import { useCurrentBuilding } from '../../store/store'
import type { PeopleContext } from './PeoplePage'

/** Add / edit person, shown as a popup over the People list (nested route). */
export function PersonFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { people, reload } = useOutletContext<PeopleContext>()
  const building = useCurrentBuilding()
  const existing = id ? people?.find((p) => p.id === id) : undefined
  const close = () => navigate(`/buildings/${building.id}/people`)

  if (id && !people) return null // still loading the list
  if (id && !existing) {
    return (
      <Modal title="Person" onClose={close}>
        <p className="muted">That person no longer exists.</p>
      </Modal>
    )
  }
  return <PersonForm key={id ?? 'new'} buildingId={building.id} buildingName={building.name} existing={existing} onSaved={reload} onClose={close} />
}

function PersonForm({
  buildingId,
  buildingName,
  existing,
  onSaved,
  onClose,
}: {
  buildingId: string
  buildingName: string
  existing?: { id: string; name: string; apartment: string }
  onSaved: () => void
  onClose: () => void
}) {
  const savedPhoto = existing ? personPhotoUrl(existing.id) : null
  const [name, setName] = useState(existing?.name ?? '')
  const [apartment, setApartment] = useState(existing?.apartment ?? '')
  const [photo, setPhoto] = useState<string | null>(savedPhoto)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return setError('Enter a name.')
    if (!photo) return setError('Add a face photo. The terminal matches against it.')
    const form = new FormData()
    form.set('name', name.trim())
    form.set('apartment', apartment.trim())
    if (photo !== savedPhoto) form.set('photo', await dataUrlToBlob(photo), 'photo.jpg')

    setSaving(true)
    setError(null)
    try {
      if (existing) await api(`/people/${existing.id}`, { method: 'PATCH', form })
      else await api(`/buildings/${buildingId}/people`, { method: 'POST', form })
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={existing ? `Edit ${existing.name}` : `Add person · ${buildingName}`} onClose={onClose} wide>
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
            <PhotoPicker value={photo} onChange={setPhoto} />
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
            {saving ? 'Checking the face…' : existing ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
