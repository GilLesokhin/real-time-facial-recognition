import { useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/api'
import { Modal } from './Modal'

interface ConfirmModalProps {
  title: string
  children: ReactNode
  confirmLabel: string
  /** Closes the dialog when it finishes. If it throws, the error shows and the dialog stays open. */
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

/** Confirmation for destructive actions (remove person, terminal, building). */
export function ConfirmModal({ title, children, confirmLabel, onConfirm, onClose }: ConfirmModalProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{children}</p>
      <div className="form-actions">
        {error && (
          <p className="error small" style={{ marginRight: 'auto', alignSelf: 'center' }}>
            {error}
          </p>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm()
              onClose()
            } catch (err) {
              setError(errorMessage(err))
              setBusy(false)
            }
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
