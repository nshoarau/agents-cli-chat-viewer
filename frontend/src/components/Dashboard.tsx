import React, { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { apiClient } from '../services/apiClient';
import type { Conversation, ConversationListResponse } from '../types';
import { ConversationList } from './ConversationList';
import { ConversationDetail } from './ConversationDetail';
import { useLogUpdates } from '../hooks/useLogUpdates';
import { FilterBar } from './FilterBar';
import { SearchBar } from './SearchBar';
import { ToastNotification } from './ToastNotification';
import { useConversationStore } from '../store/useConversationStore';
import { WatchFoldersPanel } from './WatchFoldersPanel';
import { getNextConversationIdAfterDelete } from './dashboardUtils';

const CONVERSATIONS_PAGE_SIZE = 200;
const TOAST_DURATION_MS = 2600;

interface ToastState {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

export const Dashboard: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [isWatchFoldersOpen, setIsWatchFoldersOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const { showArchived, searchQuery, selectedAgent } = useConversationStore();

  useLogUpdates();

  const {
    data: conversationPages,
    isPending: isListLoading,
    error: listError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['conversations', selectedAgent],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await apiClient.get<ConversationListResponse>('/conversations', {
        params: selectedAgent === 'all' ? {} : { agentType: selectedAgent },
        paramsSerializer: (params) => {
          const searchParams = new URLSearchParams();
          Object.entries({
            ...params,
            offset: String(pageParam),
            limit: String(CONVERSATIONS_PAGE_SIZE),
          }).forEach(([key, value]) => {
            if (value) {
              searchParams.set(key, value);
            }
          });
          return searchParams.toString();
        },
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    enabled: selectedAgent !== 'none',
  });

  const conversations = useMemo(
    () => conversationPages?.pages.flatMap((page) => page.items) ?? [],
    [conversationPages]
  );
  const totalConversations = conversationPages?.pages[0]?.total ?? 0;

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, TOAST_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  // Filter list based on store and search query
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Agent filter
      if (selectedAgent !== 'all' && selectedAgent !== 'none' && c.agentType !== selectedAgent) {
        return false;
      }

      // Archive filter
      if (!showArchived && c.status === 'archived') return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = c.title?.toLowerCase().includes(query);
        const matchesAgent = c.agentType?.toLowerCase().includes(query);
        return matchesTitle || matchesAgent;
      }

      return true;
    });
  }, [conversations, showArchived, searchQuery, selectedAgent]);

  const selectedConversation = conversations.find((item) => item.id === selectedId);

  const showToast = (message: string, tone: ToastState['tone'] = 'success') => {
    setToast({
      id: Date.now(),
      message,
      tone,
    });
  };

  const handleConversationDeleted = (deletedId: string) => {
    setSelectedId(getNextConversationIdAfterDelete(filteredConversations, deletedId));
  };

  const { data: conversation, isLoading: isDetailLoading, error: detailError } = useQuery({
    queryKey: ['conversation', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await apiClient.get<Conversation>(`/conversations/${selectedId}`);

      return res.data;
    },
    enabled: !!selectedConversation,
  });

  if (detailError) {
      console.error('Detail Query Error:', detailError);
  }

  return (
    <div className="dashboard-container">
      <main className="dashboard-content">
        <aside className="sidebar">
          <div className="sidebar-utilities">
            <div className="sidebar-filter-card sidebar-utility-card">
              <div className="sidebar-filter-title">Search Conversations</div>
              <SearchBar />
            </div>
            <div className="sidebar-filter-card sidebar-utility-card">
              <div className="sidebar-filter-title">Workspace</div>
              <button className="btn-add-folder sidebar-action-button" onClick={() => setIsWatchFoldersOpen(true)}>
                Watched Folders
              </button>
            </div>
          </div>
          <FilterBar />
          {selectedAgent === 'none' ? (
            <div className="empty-list">Choose an agent filter to load conversations.</div>
          ) : isListLoading ? (
            <div className="list-loading">Loading conversations...</div>
          ) : listError ? (
            <div className="list-error">Error loading list: {getErrorMessage(listError)}</div>
          ) : (
            <ConversationList
              conversations={filteredConversations}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          )}
          {selectedAgent !== 'none' && hasNextPage ? (
            <div className="sidebar-pagination">
              <button className="btn-load-more" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage
                  ? 'Loading...'
                  : `Load More (${Math.max(totalConversations - conversations.length, 0)} remaining)`}
              </button>
            </div>
          ) : null}
        </aside>
        <section className="detail-panel">
          {isDetailLoading ? (
            <div className="detail-placeholder">Loading conversation...</div>
          ) : detailError ? (
             <div className="detail-placeholder">Error: {getErrorMessage(detailError)}</div>
          ) : (
            <ConversationDetail
              conversation={conversation!}
              isLoading={false}
              onShowToast={showToast}
              onConversationDeleted={handleConversationDeleted}
            />
          )}
        </section>
      </main>
      {toast ? <ToastNotification tone={toast.tone} message={toast.message} /> : null}
      <WatchFoldersPanel
        isOpen={isWatchFoldersOpen}
        onClose={() => setIsWatchFoldersOpen(false)}
      />
    </div>
  );
};
