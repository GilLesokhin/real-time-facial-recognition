import type { ReactNode } from 'react'
import { Modal } from './Modal'

interface ConfirmModalProps {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

/** Confirmation for destructive actions (remove person, terminal, building). */
export function ConfirmModal({ title, children, confirmLabel, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{children}</p>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
