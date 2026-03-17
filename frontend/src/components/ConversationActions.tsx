import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { Conversation } from '../types';

interface ConversationActionsProps {
  conversation: Conversation;
}

export const ConversationActions: React.FC<ConversationActionsProps> = ({ conversation }) => {
  const queryClient = useQueryClient();

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = conversation.status === 'active' ? 'archived' : 'active';
      await apiClient.patch(`/conversations/${conversation.id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (window.confirm('Are you sure you want to delete this conversation file?')) {
        await apiClient.delete(`/conversations/${conversation.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Reset selection if possible via a parent callback, but for now just refresh
    },
  });

  return (
    <div className="conversation-actions">
      <button onClick={() => toggleStatusMutation.mutate()} disabled={toggleStatusMutation.isPending}>
        {conversation.status === 'active' ? 'Archive' : 'Restore'}
      </button>
      <button
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
        className="btn-delete"
      >
        Delete
      </button>
    </div>
  );
};
