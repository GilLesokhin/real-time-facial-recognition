import { useState, type SubmitEvent } from 'react'
import { ExternalLink, MonitorSmartphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { useApi } from '../../hooks/useApi'
import { api, errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { useCurrentBuilding } from '../../store/store'
import type { Terminal } from '../../types'

/**
 * Signs the terminal in with a new key and opens it in its own tab, like a separate device at the door.
 * The key travels in the URL #fragment, which the browser never sends to a server.
 * The tab opens first (blank), because browsers block pop-ups opened after an `await`.
 * Throws ApiError if the key can't be made.
 */
async function openTerminal(terminal: Terminal) {
  const tab = window.open('', `terminal-${terminal.id}`)
  try {
    const { key } = await api<{ key: string }>(`/terminals/${terminal.id}/key`, { method: 'POST' })
    const url = `/terminal/${terminal.id}#key=${encodeURIComponent(key)}`
    if (tab) tab.location.href = url
    else window.location.href = url
  } catch (err) {
    tab?.close()
    throw err
  }
}

type Dialog = { kind: 'add' } | { kind: 'edit' | 'remove'; terminal: Terminal }

export function TerminalsPage() {
  const currentBuilding = useCurrentBuilding()
  const { data: terminals, error, reload } = useApi<Terminal[]>(`/buildings/${currentBuilding.id}/terminals`)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const close = () => setDialog(null)

  const open = async (terminal: Terminal) => {
    setOpenError(null)
    try {
      await openTerminal(terminal)
    } catch (err) {
      setOpenError(`Couldn't open ${terminal.name}: ${errorMessage(err)}`)
    }
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

      {openError && <p className="error small">{openError}</p>}

      <div className="card table-wrap">
        {error ? (
          <p className="empty error">{error}</p>
        ) : !terminals ? (
          <p className="empty muted">Loading…</p>
        ) : terminals.length === 0 ? (
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
                    {t.last_result && t.last_at ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge badge-${t.last_result}`}>{t.last_result}</span>
                        <span className="muted">{formatDateTime(t.last_at)}</span>
                      </div>
                    ) : (
                      <span className="faint">No checks yet</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm" onClick={() => open(t)}>
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

      {dialog?.kind === 'add' && <TerminalForm buildingId={currentBuilding.id} onClose={close} onSaved={reload} />}
      {dialog?.kind === 'edit' && (
        <TerminalForm buildingId={currentBuilding.id} terminal={dialog.terminal} onClose={close} onSaved={reload} />
      )}
      {dialog?.kind === 'remove' && (
        <ConfirmModal
          title={`Remove ${dialog.terminal.name}?`}
          confirmLabel="Remove"
          onConfirm={async () => {
            await api(`/terminals/${dialog.terminal.id}`, { method: 'DELETE' })
            reload()
          }}
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
  onClose,
  onSaved,
}: {
  buildingId: string
  terminal?: Terminal
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(terminal?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const body = { name: name.trim() }
      if (terminal) await api(`/terminals/${terminal.id}`, { method: 'PATCH', body })
      else await api(`/buildings/${buildingId}/terminals`, { method: 'POST', body })
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
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
            autoFocus
          />
        </label>
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
            {terminal ? 'Save' : 'Add terminal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
