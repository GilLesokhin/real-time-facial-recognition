import { useEffect, useState, type SubmitEvent } from 'react'
import { ExternalLink, MonitorSmartphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { ApiError } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useCurrentBuilding, useStore } from '../../store/store'
import type { Terminal, TerminalListItem } from '../../types'

/** Each terminal opens in its own tab (reused if already open), like a separate device at the door. */
const openTerminal = (terminal: Terminal) => window.open(`/terminal/${terminal.id}`, `terminal-${terminal.id}`)

type Dialog = { kind: 'add' } | { kind: 'edit' | 'remove'; terminal: Terminal }

const errorMessage = (err: unknown) => {
  if (err instanceof ApiError && err.status === 409) return err.message
  if (err instanceof ApiError && err.status === 404) return 'This terminal no longer exists. Reload the page.'
  return "Can't reach the server. Try again in a moment."
}

export function TerminalsPage() {
  const { listTerminals, removeTerminal } = useStore()
  const currentBuilding = useCurrentBuilding()
  const [terminals, setTerminals] = useState<TerminalListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped after a change, to load the list again.
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  useEffect(() => {
    // Ignore an answer that arrives after the building changed.
    let cancelled = false
    listTerminals(currentBuilding.id)
      .then((list) => {
        if (cancelled) return
        setTerminals(list)
        setError(null)
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [listTerminals, currentBuilding.id, version])

  const remove = (terminal: Terminal) => {
    setError(null)
    removeTerminal(terminal.id)
      .then(reload)
      .catch((err) => setError(errorMessage(err)))
  }

  return (
    <>
      <div className="page-header">
        <div>
          <span className="label">{currentBuilding.name}</span>
          <h1 className="title">Terminals</h1>
          <p className="muted">One per door. Open a terminal to run it in its own tab with this computer's webcam.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'add' })}>
          <Plus size={16} /> Add terminal
        </button>
      </div>

      {error && <p className="small error">{error}</p>}

      <div className="card table-wrap">
        {terminals === null ? null : terminals.length === 0 ? (
          <p className="empty muted">No terminals yet. Add one for each door.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th className="label">Terminal</th>
                <th className="label">Last check</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {terminals.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="cell-row">
                      <span className="avatar" style={{ width: 32, height: 32 }}>
                        <MonitorSmartphone size={16} />
                      </span>
                      {t.name}
                    </div>
                  </td>
                  <td>
                    {t.latest_event ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge badge-${t.latest_event.result}`}>{t.latest_event.result}</span>
                        <span className="muted">{formatDateTime(t.latest_event.created_at)}</span>
                      </div>
                    ) : (
                      <span className="faint">No checks yet</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm" onClick={() => openTerminal(t)}>
                        <ExternalLink size={14} /> Open
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Rename ${t.name}`}
                        onClick={() => setDialog({ kind: 'edit', terminal: t })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Remove ${t.name}`}
                        onClick={() => setDialog({ kind: 'remove', terminal: t })}
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

      {dialog?.kind === 'add' && <TerminalForm buildingId={currentBuilding.id} onSaved={reload} onClose={close} />}
      {dialog?.kind === 'edit' && (
        <TerminalForm buildingId={currentBuilding.id} terminal={dialog.terminal} onSaved={reload} onClose={close} />
      )}
      {dialog?.kind === 'remove' && (
        <ConfirmModal
          title={`Remove ${dialog.terminal.name}?`}
          confirmLabel="Remove"
          onConfirm={() => remove(dialog.terminal)}
          onClose={close}
        >
          The terminal at this door stops working. Its past checks stay in the access log.
        </ConfirmModal>
      )}
    </>
  )
}

function TerminalForm({
  buildingId,
  terminal,
  onSaved,
  onClose,
}: {
  buildingId: string
  terminal?: Terminal
  onSaved: () => void
  onClose: () => void
}) {
  const { addTerminal, renameTerminal } = useStore()
  const [name, setName] = useState(terminal?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return
    setPending(true)
    setError(null)
    try {
      if (terminal) await renameTerminal(terminal.id, name.trim())
      else await addTerminal(buildingId, name.trim())
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title={terminal ? 'Rename terminal' : 'Add terminal'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit}>
        <label className="field">
          <span className="label">Door name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main lobby"
            maxLength={255}
            autoFocus
          />
        </label>
        {error && <p className="small error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || pending}>
            {terminal ? 'Save' : 'Add terminal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
