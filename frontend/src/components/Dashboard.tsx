import React, { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { apiClient } from '../services/apiClient';
import type { Conversation, ConversationListResponse, WatchFoldersResponse } from '../types';
import { ConversationList } from './ConversationList';
import { ConversationDetail } from './ConversationDetail';
import { useLogUpdates } from '../hooks/useLogUpdates';
import { FilterBar } from './FilterBar';
import { SearchBar } from './SearchBar';
import { ToastNotification } from './ToastNotification';
import { useConversationStore } from '../store/useConversationStore';
import { WatchFoldersPanel } from './WatchFoldersPanel';
import { getNextConversationIdAfterDelete } from './dashboardUtils';
import {
  loadConversationDetailPreferences,
  persistConversationDetailPreferences,
} from './conversationDetailUtils';

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
  const initialPreferences = useMemo(() => loadConversationDetailPreferences(), []);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [isWatchFoldersOpen, setIsWatchFoldersOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialPreferences.sidebarCollapsed);
  const { showArchived, searchQuery, selectedAgent } = useConversationStore();

  useLogUpdates();

  const showToast = (message: string, tone: ToastState['tone'] = 'success') => {
    setToast({
      id: Date.now(),
      message,
      tone,
    });
  };

  const { data: watchFoldersView } = useQuery({
    queryKey: ['watch-folders'],
    queryFn: async () => {
      const response = await apiClient.get<WatchFoldersResponse>('/config/watch-folders');
      return response.data;
    },
  });

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

  useEffect(() => {
    const preferences = loadConversationDetailPreferences();
    persistConversationDetailPreferences({
      ...preferences,
      sidebarCollapsed: isSidebarCollapsed,
    });
  }, [isSidebarCollapsed]);

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

  const searchSuggestions = useMemo(() => {
    const visibleConversations = conversations.filter((conversation) => {
      if (selectedAgent !== 'all' && selectedAgent !== 'none' && conversation.agentType !== selectedAgent) {
        return false;
      }

      if (!showArchived && conversation.status === 'archived') {
        return false;
      }

      return Boolean(conversation.title?.trim());
    });

    return [...new Set(visibleConversations.map((conversation) => conversation.title.trim()))];
  }, [conversations, selectedAgent, showArchived]);

  const selectedConversation = conversations.find((item) => item.id === selectedId);
  const configuredWatchFolders = watchFoldersView?.folders ?? [];
  const recommendedWatchFolders = watchFoldersView?.recommendations ?? [];
  const hasIndexedConversations = totalConversations > 0;
  const hasAnyConfiguredFolders = configuredWatchFolders.length > 0;
  const hasRecommendations = recommendedWatchFolders.length > 0;

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

  const renderSidebarEmptyState = () => {
    if (!hasIndexedConversations) {
      return (
        <div className="empty-state-card empty-state-card-sidebar">
          <div className="empty-state-eyebrow">Onboarding</div>
          <h3>No conversations indexed yet</h3>
          <p>
            {hasRecommendations
              ? `I found ${recommendedWatchFolders.length} recommended agent folder${
                  recommendedWatchFolders.length === 1 ? '' : 's'
                } on this machine. Enable them to start importing sessions.`
              : hasAnyConfiguredFolders
                ? 'Folders are configured, but no supported conversations have been indexed yet.'
                : 'Add a watched folder to start indexing Codex, Claude, or Gemini sessions.'}
          </p>
          <div className="empty-state-actions">
            <button className="btn-add-folder" onClick={() => setIsWatchFoldersOpen(true)}>
              {hasRecommendations ? 'Review Suggested Sources' : 'Set Up Watched Folders'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="empty-list">
        {searchQuery
          ? 'No conversations match the current search.'
          : 'No conversations match the current filters.'}
      </div>
    );
  };

  const renderDetailEmptyState = () => {
    if (isDetailLoading) {
      return <div className="detail-placeholder">Loading conversation...</div>;
    }

    if (detailError) {
      return <div className="detail-placeholder">Error: {getErrorMessage(detailError)}</div>;
    }

    if (!hasIndexedConversations) {
      return (
        <div className="detail-placeholder">
          <div className="empty-state-card empty-state-card-detail">
            <div className="empty-state-eyebrow">Get Started</div>
            <h3>Connect your agent folders</h3>
            <p>
              Use the watched folders wizard to enable detected Claude, Codex, or Gemini locations,
              or add a custom path manually.
            </p>
            <div className="empty-state-actions">
              <button className="btn-add-folder" onClick={() => setIsWatchFoldersOpen(true)}>
                Open Watched Folders
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <ConversationDetail
        conversation={conversation ?? undefined}
        isLoading={false}
        onShowToast={showToast}
        onConversationDeleted={handleConversationDeleted}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        onSetSidebarCollapsed={setIsSidebarCollapsed}
      />
    );
  };

  return (
    <div className="dashboard-container">
      <main className="dashboard-content">
        <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? '»' : '«'}
          </button>
          {!isSidebarCollapsed ? (
            <>
          <div className="sidebar-utilities">
            <div className="sidebar-filter-card sidebar-utility-card">
              <div className="sidebar-filter-title">Search Conversations</div>
              <SearchBar suggestions={searchSuggestions} />
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
              selectedAgentMode={selectedAgent}
              emptyState={renderSidebarEmptyState()}
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
            </>
          ) : (
            <div className="sidebar-collapsed-hint">Transcript mode</div>
          )}
        </aside>
        <section className="detail-panel">
          {renderDetailEmptyState()}
        </section>
      </main>
      {toast ? <ToastNotification tone={toast.tone} message={toast.message} /> : null}
      <WatchFoldersPanel
        isOpen={isWatchFoldersOpen}
        onClose={() => setIsWatchFoldersOpen(false)}
        onShowToast={showToast}
        shouldHighlightRecommendations={!hasIndexedConversations && hasRecommendations}
      />
    </div>
  );
};
