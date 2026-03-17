import React, { useEffect } from 'react';

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  isDanger?: boolean;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  description,
  confirmLabel,
  isDanger = false,
  isPending = false,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-modal-title">{title}</h3>
        <p>{description}</p>
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-button"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`confirm-modal-button confirm-modal-button-primary ${isDanger ? 'danger' : ''}`}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
