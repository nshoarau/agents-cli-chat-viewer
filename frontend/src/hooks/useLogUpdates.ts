import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { ConversationLogEvent } from '../types';

export const useLogUpdates = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const baseURL = apiClient.defaults.baseURL || 'http://localhost:3000/api';
    const sseURL = `${baseURL}/events`;
    const eventSource = new EventSource(sseURL);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ConversationLogEvent;
        console.log('Received log update:', data);

        queryClient.invalidateQueries({ queryKey: ['conversations'] });

        if (data.id) {
          queryClient.removeQueries({ queryKey: ['conversation', data.id] });
          queryClient.invalidateQueries({ queryKey: ['conversation', data.id] });
        }
      } catch (error) {
        console.error('Failed to parse SSE event data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);
};
