import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { Conversation } from '../types';

interface ConversationActionsProps {
  conversation: Conversation;
}

type PendingAction = 'toggle-status' | 'delete' | null;

const ArchiveIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v2A1.5 1.5 0 0 1 18.5 9H18v9.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18.5V9h-.5A1.5 1.5 0 0 1 4 7.5v-2Zm2 3.5v9h10V9H6Zm-.5-3a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-13ZM9 12.5c0-.276.224-.5.5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Z"
      fill="currentColor"
    />
  </svg>
);

const RestoreIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 5a7 7 0 1 1-6.65 9.18.5.5 0 1 1 .95-.31A6 6 0 1 0 12 6c-1.68 0-3.2.69-4.29 1.8H10.5a.5.5 0 0 1 0 1H6.5A1.5 1.5 0 0 1 5 7.3v-4a.5.5 0 0 1 1 0v3.45A6.96 6.96 0 0 1 12 5Zm-.5 3.5a.5.5 0 0 1 1 0v3.79l2.27 1.31a.5.5 0 1 1-.5.86l-2.52-1.46a.5.5 0 0 1-.25-.43V8.5Z"
      fill="currentColor"
    />
  </svg>
);

const DeleteIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V5h3.5a.5.5 0 0 1 0 1H18v12.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18.5V6h-.5a.5.5 0 0 1 0-1H9v-.5Zm1 0V5h4v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5ZM7 6v12.5a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V6H7Zm3 3a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6A.5.5 0 0 1 10 9Zm4 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0v-6A.5.5 0 0 1 14 9Z"
      fill="currentColor"
    />
  </svg>
);

export const ConversationActions: React.FC<ConversationActionsProps> = ({ conversation }) => {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const isArchiveAction = conversation.status === 'active';
  const confirmCopy = useMemo(
    () =>
      pendingAction === 'delete'
        ? {
            title: 'Delete Conversation?',
            description:
              'This permanently deletes the conversation file from disk. This action cannot be undone.',
            confirmLabel: 'Delete',
          }
        : {
            title: isArchiveAction ? 'Archive Conversation?' : 'Restore Conversation?',
            description: isArchiveAction
              ? 'This will hide the conversation from the default active view until you restore it.'
              : 'This will return the conversation to the active view.',
            confirmLabel: isArchiveAction ? 'Archive' : 'Restore',
          },
    [isArchiveAction, pendingAction]
  );

  useEffect(() => {
    if (!pendingAction) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingAction(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingAction]);

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = conversation.status === 'active' ? 'archived' : 'active';
      await apiClient.patch(`/conversations/${conversation.id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      setPendingAction(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/conversations/${conversation.id}`);
    },
    onSuccess: () => {
      setPendingAction(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Reset selection if possible via a parent callback, but for now just refresh
    },
  });

  const isConfirmPending = toggleStatusMutation.isPending || deleteMutation.isPending;

  const handleConfirm = () => {
    if (pendingAction === 'delete') {
      deleteMutation.mutate();
      return;
    }

    if (pendingAction === 'toggle-status') {
      toggleStatusMutation.mutate();
    }
  };

  return (
    <>
      <div className="conversation-actions">
        <button
          type="button"
          onClick={() => setPendingAction('toggle-status')}
          disabled={toggleStatusMutation.isPending}
          className="conversation-action-button"
          aria-label={conversation.status === 'active' ? 'Archive conversation' : 'Restore conversation'}
          title={conversation.status === 'active' ? 'Archive conversation' : 'Restore conversation'}
        >
          {conversation.status === 'active' ? <ArchiveIcon /> : <RestoreIcon />}
        </button>
        <button
          type="button"
          onClick={() => setPendingAction('delete')}
          disabled={deleteMutation.isPending}
          className="conversation-action-button btn-delete"
          aria-label="Delete conversation"
          title="Delete conversation"
        >
          <DeleteIcon />
        </button>
      </div>
      {pendingAction ? (
        <div className="confirm-modal-overlay" onClick={() => setPendingAction(null)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-modal-title">{confirmCopy.title}</h3>
            <p>{confirmCopy.description}</p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="confirm-modal-button"
                onClick={() => setPendingAction(null)}
                disabled={isConfirmPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`confirm-modal-button confirm-modal-button-primary ${
                  pendingAction === 'delete' ? 'danger' : ''
                }`}
                onClick={handleConfirm}
                disabled={isConfirmPending}
              >
                {isConfirmPending ? 'Working...' : confirmCopy.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
