import { useState, type SubmitEvent } from 'react'
import { ExternalLink, MonitorSmartphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { Modal } from '../../components/Modal'
import { formatDateTime } from '../../lib/format'
import { useStore } from '../../store/store'
import type { Terminal } from '../../types'

/** Each terminal opens in its own tab (reused if already open), like a separate device at the door. */
const openTerminal = (terminal: Terminal) => window.open(`/terminal/${terminal.id}`, `terminal-${terminal.id}`)

type Dialog = { kind: 'add' } | { kind: 'edit' | 'remove'; terminal: Terminal }

export function TerminalsPage() {
  const { state, currentBuilding, removeTerminal } = useStore()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  if (!currentBuilding) return <p className="card empty muted">No building selected.</p>

  const terminals = state.terminals.filter((t) => t.building_id === currentBuilding.id)

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

      <div className="card table-wrap">
        {terminals.length === 0 ? (
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
              {terminals.map((t) => {
                const last = state.events.find((ev) => ev.terminal_id === t.id)
                return (
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
                      {last ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`badge badge-${last.result}`}>{last.result}</span>
                          <span className="muted">{formatDateTime(last.at)}</span>
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {dialog?.kind === 'add' && <TerminalForm buildingId={currentBuilding.id} onClose={close} />}
      {dialog?.kind === 'edit' && <TerminalForm buildingId={currentBuilding.id} terminal={dialog.terminal} onClose={close} />}
      {dialog?.kind === 'remove' && (
        <ConfirmModal
          title={`Remove ${dialog.terminal.name}?`}
          confirmLabel="Remove"
          onConfirm={() => removeTerminal(dialog.terminal.id)}
          onClose={close}
        >
          The terminal at this door stops working. Its past checks stay in the access log.
        </ConfirmModal>
      )}
    </>
  )
}

function TerminalForm({ buildingId, terminal, onClose }: { buildingId: string; terminal?: Terminal; onClose: () => void }) {
  const { addTerminal, updateTerminal } = useStore()
  const [name, setName] = useState(terminal?.name ?? '')

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) return
    if (terminal) updateTerminal({ ...terminal, name: name.trim() })
    else addTerminal(buildingId, name.trim())
    onClose()
  }

  return (
    <Modal title={terminal ? "Rename terminal" : "Add terminal"} onClose={onClose} wide>
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
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {terminal ? 'Save' : 'Add terminal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
