import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { apiClient } from '../services/apiClient';
import type { AgentType, Conversation, ConversationListResponse, ConversationSummary, WatchFoldersResponse } from '../types';
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
import { AgentIcon } from './AgentIcon';

const CONVERSATIONS_PAGE_SIZE = 200;
const TOAST_DURATION_MS = 2600;

interface ToastState {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
}

type AgentLauncherOption = {
  agent: 'all' | 'claude' | 'codex' | 'gemini';
  title: string;
  description: string;
};

type ActivityDaySummary = {
  label: string;
  total: number;
  byAgent: Record<AgentType, number>;
};

const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
};

const DAY_WINDOW = 7;

const toTimestamp = (value?: string): number => {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
};

const formatActivityTimestamp = (value: string): string => {
  const timestamp = toTimestamp(value);

  if (Number.isNaN(timestamp)) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
};

const buildActivityDaySummaries = (items: ConversationSummary[]): ActivityDaySummary[] => {
  const latestTimestamp = items.reduce((latest, conversation) => {
    const timestamp = toTimestamp(conversation.timestamp);
    if (Number.isNaN(timestamp)) {
      return latest;
    }
    return Math.max(latest, timestamp);
  }, Number.NEGATIVE_INFINITY);
  const anchorDate = Number.isFinite(latestTimestamp) ? new Date(latestTimestamp) : new Date();

  const days = Array.from({ length: DAY_WINDOW }, (_, index) => {
    const date = new Date(anchorDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(anchorDate.getDate() - (DAY_WINDOW - index - 1));

    return {
      key: date.toISOString().slice(0, 10),
      date,
      label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      total: 0,
      byAgent: {
        claude: 0,
        codex: 0,
        gemini: 0,
      } satisfies Record<AgentType, number>,
    };
  });

  const dayIndex = new Map(days.map((day, index) => [day.key, index]));

  items.forEach((conversation) => {
    const timestamp = toTimestamp(conversation.timestamp);
    if (Number.isNaN(timestamp)) {
      return;
    }

    const dayKey = new Date(timestamp).toISOString().slice(0, 10);
    const index = dayIndex.get(dayKey);

    if (index === undefined) {
      return;
    }

    days[index].total += 1;
    days[index].byAgent[conversation.agentType] += 1;
  });

  return days.map(({ label, total, byAgent }) => ({ label, total, byAgent }));
};

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
  const detailPanelRef = useRef<HTMLElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [isWatchFoldersOpen, setIsWatchFoldersOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'full' | 'reduced' | 'hidden'>(
    initialPreferences.sidebarMode
  );
  const [activityView, setActivityView] = useState<'bars' | 'mix'>('mix');
  const { showArchived, searchQuery, selectedAgent, setSelectedAgent } = useConversationStore();
  const isSidebarCollapsed = sidebarMode === 'hidden';
  const isSidebarReduced = sidebarMode === 'reduced';

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
      sidebarCollapsed: sidebarMode === 'hidden',
      sidebarMode,
    });
  }, [sidebarMode]);

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

  const chartConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        if (!showArchived && conversation.status === 'archived') {
          return false;
        }

        return true;
      }),
    [conversations, showArchived]
  );

  const recentConversations = useMemo(
    () =>
      [...filteredConversations]
        .sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp))
        .slice(0, 4),
    [filteredConversations]
  );

  const recentActivityDays = useMemo(
    () => buildActivityDaySummaries(chartConversations),
    [chartConversations]
  );

  const overviewStats = useMemo(() => {
    const agentCounts = filteredConversations.reduce<Record<AgentType, number>>(
      (counts, conversation) => {
        counts[conversation.agentType] += 1;
        return counts;
      },
      { claude: 0, codex: 0, gemini: 0 }
    );
    const activeCount = filteredConversations.filter((conversation) => conversation.status === 'active').length;
    const archivedCount = filteredConversations.filter((conversation) => conversation.status === 'archived').length;
    const totalMessages = filteredConversations.reduce(
      (total, conversation) => total + conversation.messageCount,
      0
    );
    const projectCounts = filteredConversations.reduce<Map<string, number>>((counts, conversation) => {
      const projectName = conversation.project?.trim() || 'Unscoped';
      counts.set(projectName, (counts.get(projectName) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
    const mostActiveProjectEntry = [...projectCounts.entries()].sort((left, right) => right[1] - left[1])[0];

    return {
      activeCount,
      archivedCount,
      totalMessages,
      projectCount: projectCounts.size,
      mostActiveProject: mostActiveProjectEntry?.[0] ?? 'Unscoped',
      busiestAgent:
        ([...Object.entries(agentCounts)].sort((left, right) => right[1] - left[1])[0]?.[0] as AgentType | undefined) ??
        'codex',
      latestConversation: recentConversations[0],
    };
  }, [filteredConversations, recentConversations]);

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
  const configuredWatchFolders = useMemo(
    () => watchFoldersView?.folders ?? [],
    [watchFoldersView?.folders]
  );
  const recommendedWatchFolders = useMemo(
    () => watchFoldersView?.recommendations ?? [],
    [watchFoldersView?.recommendations]
  );
  const hasIndexedConversations = totalConversations > 0;
  const hasAnyConfiguredFolders = configuredWatchFolders.length > 0;
  const hasRecommendations = recommendedWatchFolders.length > 0;
  const availableAgentOptions = useMemo<AgentLauncherOption[]>(() => {
    const detectedAgents = new Set<'claude' | 'codex' | 'gemini'>();

    configuredWatchFolders.forEach((folder) => {
      const folderText = `${folder.label} ${folder.sourcePath} ${folder.targetName}`.toLowerCase();

      if (folderText.includes('claude')) {
        detectedAgents.add('claude');
      }
      if (folderText.includes('codex')) {
        detectedAgents.add('codex');
      }
      if (folderText.includes('gemini')) {
        detectedAgents.add('gemini');
      }
    });

    const orderedAgents: AgentLauncherOption[] = [];

    if (detectedAgents.size > 1) {
      orderedAgents.push({
        agent: 'all',
        title: 'All Agents',
        description: 'Open the complete combined session list across every configured source.',
      });
    }

    (
      [
        ['claude', 'Claude', 'Browse imported Claude sessions from your watched folders.'],
        ['codex', 'Codex', 'Open Codex session logs directly from the indexed workspace.'],
        ['gemini', 'Gemini', 'Jump into Gemini conversations without using the compact filter bar.'],
      ] as const
    ).forEach(([agent, title, description]) => {
      if (!detectedAgents.has(agent)) {
        return;
      }

      orderedAgents.push({
        agent,
        title,
        description,
      });
    });

    return orderedAgents;
  }, [configuredWatchFolders]);

  const handleConversationDeleted = (deletedId: string) => {
    setSelectedId(getNextConversationIdAfterDelete(filteredConversations, deletedId));
  };

  useEffect(() => {
    if (selectedConversation || !hasIndexedConversations) {
      return;
    }

    if (typeof detailPanelRef.current?.scrollTo === 'function') {
      detailPanelRef.current.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    if (detailPanelRef.current) {
      detailPanelRef.current.scrollTop = 0;
    }
  }, [hasIndexedConversations, selectedConversation]);

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

    if (selectedAgent === 'none' && availableAgentOptions.length > 0) {
      return (
        <div className="detail-placeholder detail-placeholder-agent-launcher">
          <div className="agent-launcher-card">
            <div className="empty-state-eyebrow">Load Conversations</div>
            <h3>Choose an agent source</h3>
            <p>
              Watched folders are already configured. Pick an agent below to open the indexed
              conversations directly.
            </p>
            <div className="agent-launcher-grid">
              {availableAgentOptions.map((option) => (
                <button
                  key={option.agent}
                  type="button"
                  className="agent-launcher-button"
                  onClick={() => {
                    setSelectedId(undefined);
                    setSelectedAgent(option.agent);
                  }}
                  aria-label={`Load ${option.title}`}
                >
                  <span className="agent-launcher-icon-shell">
                    <AgentIcon agent={option.agent} className="agent-launcher-icon" />
                  </span>
                  <span className="agent-launcher-copy">
                    <span className="agent-launcher-title">{option.title}</span>
                    <span className="agent-launcher-description">{option.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="agent-launcher-footer">
              Need to change sources?{' '}
              <button
                type="button"
                className="agent-launcher-inline-action"
                onClick={() => setIsWatchFoldersOpen(true)}
              >
                Open Watched Folders
              </button>
            </div>
          </div>
        </div>
      );
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

    if (!selectedConversation) {
      return (
        <div className="detail-placeholder detail-placeholder-dashboard">
          <div className="recent-activity-dashboard">
            <div className="recent-activity-hero">
              <div className="empty-state-eyebrow">Recent Activity</div>
              <h2>Session traffic at a glance</h2>
              <p>
                A live overview of the conversations currently visible in the sidebar, with the latest work
                front and center.
              </p>
              <div className="recent-activity-hero-meta">
                <span>{filteredConversations.length} visible sessions</span>
                <span>{overviewStats.totalMessages} messages indexed</span>
                <span>{overviewStats.projectCount} projects active</span>
              </div>
            </div>

            <div className="recent-activity-metrics" aria-label="Activity metrics">
              <article className="recent-activity-metric-card">
                <span className="recent-activity-metric-label">Live Sessions</span>
                <strong>{overviewStats.activeCount}</strong>
                <p>{overviewStats.archivedCount} archived in the current view.</p>
              </article>
              <article className="recent-activity-metric-card">
                <span className="recent-activity-metric-label">Busiest Agent</span>
                <strong>{AGENT_DISPLAY_NAMES[overviewStats.busiestAgent]}</strong>
                <p>Leading the current feed by recent session volume.</p>
              </article>
              <article className="recent-activity-metric-card">
                <span className="recent-activity-metric-label">Top Project</span>
                <strong>{overviewStats.mostActiveProject}</strong>
                <p>Most represented workspace in the filtered conversation set.</p>
              </article>
            </div>

            <div className="recent-activity-grid">
              <section className="recent-activity-panel">
                <div className="recent-activity-panel-header">
                  <div>
                    <div className="empty-state-eyebrow">Last {DAY_WINDOW} Days</div>
                    <h3>Activity cadence</h3>
                    <p className="recent-activity-panel-note">
                      Daily session volume, split by agent, ending on the latest visible session date.
                    </p>
                  </div>
                  <div className="recent-activity-view-switch" role="tablist" aria-label="Cadence view">
                    <button
                      type="button"
                      className={`recent-activity-view-button ${activityView === 'mix' ? 'is-active' : ''}`}
                      onClick={() => setActivityView('mix')}
                    >
                      Mix
                    </button>
                    <button
                      type="button"
                      className={`recent-activity-view-button ${activityView === 'bars' ? 'is-active' : ''}`}
                      onClick={() => setActivityView('bars')}
                    >
                      Bars
                    </button>
                  </div>
                </div>
                <div className="recent-activity-chart-legend" aria-label="Chart legend">
                  <span className="recent-activity-chart-legend-item">
                    <span className="recent-activity-chart-dot is-claude" />
                    Claude
                  </span>
                  <span className="recent-activity-chart-legend-item">
                    <span className="recent-activity-chart-dot is-codex" />
                    Codex
                  </span>
                  <span className="recent-activity-chart-legend-item">
                    <span className="recent-activity-chart-dot is-gemini" />
                    Gemini
                  </span>
                </div>
                {activityView === 'bars' ? (
                  <div className="recent-activity-bars" aria-label="Activity cadence chart">
                    {recentActivityDays.map((day) => {
                      const peakCount = Math.max(...recentActivityDays.map((entry) => entry.total), 1);
                      const toSegmentStyle = (count: number) => {
                        if (count <= 0) {
                          return { height: '0%' };
                        }

                        return {
                          height: `${Math.max((count / peakCount) * 100, 10)}%`,
                          minHeight: '14px',
                        };
                      };

                      return (
                        <div key={day.label} className="recent-activity-bar-column">
                          <div className="recent-activity-bar-stack" title={`${day.label}: ${day.total} sessions`}>
                            <span
                              className="recent-activity-bar-segment is-claude"
                              style={toSegmentStyle(day.byAgent.claude)}
                            />
                            <span
                              className="recent-activity-bar-segment is-codex"
                              style={toSegmentStyle(day.byAgent.codex)}
                            />
                            <span
                              className="recent-activity-bar-segment is-gemini"
                              style={toSegmentStyle(day.byAgent.gemini)}
                            />
                          </div>
                          <span className="recent-activity-bar-value">{day.total}</span>
                          <span className="recent-activity-bar-label">{day.label}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="recent-activity-mix-list" aria-label="Activity mix list">
                    {recentActivityDays.map((day) => (
                      <div key={day.label} className="recent-activity-mix-row">
                        <div className="recent-activity-mix-day">
                          <strong>{day.label}</strong>
                          <span>{day.total} sessions</span>
                        </div>
                        <div className="recent-activity-mix-track">
                          <span
                            className="recent-activity-mix-segment is-claude"
                            style={{ flexGrow: day.byAgent.claude }}
                          />
                          <span
                            className="recent-activity-mix-segment is-codex"
                            style={{ flexGrow: day.byAgent.codex }}
                          />
                          <span
                            className="recent-activity-mix-segment is-gemini"
                            style={{ flexGrow: day.byAgent.gemini }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="recent-activity-panel">
                <div className="recent-activity-panel-header">
                  <div>
                    <div className="empty-state-eyebrow">Latest Sessions</div>
                    <h3>Recent timeline</h3>
                  </div>
                  {overviewStats.latestConversation ? (
                    <button
                      type="button"
                      className="recent-activity-open-latest"
                      onClick={() => setSelectedId(overviewStats.latestConversation?.id)}
                    >
                      Open Latest
                    </button>
                  ) : null}
                </div>
                <div className="recent-activity-timeline" aria-label="Recent conversations">
                  {recentConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className="recent-activity-timeline-item"
                      onClick={() => setSelectedId(conversation.id)}
                    >
                      <span className={`recent-activity-agent-pill is-${conversation.agentType}`}>
                        {AGENT_DISPLAY_NAMES[conversation.agentType]}
                      </span>
                      <span className="recent-activity-timeline-copy">
                        <strong>{conversation.title}</strong>
                        <span>
                          {conversation.project} · {conversation.messageCount} messages
                        </span>
                      </span>
                      <span className="recent-activity-timestamp">
                        {formatActivityTimestamp(conversation.timestamp)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
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
        onToggleSidebar={() => setSidebarMode((current) => (current === 'hidden' ? 'full' : 'hidden'))}
        onSetSidebarCollapsed={(collapsed) => setSidebarMode(collapsed ? 'hidden' : 'full')}
      />
    );
  };

  return (
    <div className="dashboard-container">
      <main className="dashboard-content">
        <aside
          className={`sidebar ${
            isSidebarCollapsed ? 'sidebar-collapsed' : isSidebarReduced ? 'sidebar-reduced' : ''
          }`}
        >
          <div className="sidebar-top-controls">
            <button
              type="button"
              className="sidebar-collapse-button"
              onClick={() => setSidebarMode((current) => (current === 'hidden' ? 'full' : 'hidden'))}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Hide sidebar'}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Hide sidebar'}
            >
              {isSidebarCollapsed ? '»' : '«'}
            </button>
            {!isSidebarCollapsed ? (
              <button
                type="button"
                className="sidebar-reduce-button"
                onClick={() => setSidebarMode((current) => (current === 'reduced' ? 'full' : 'reduced'))}
                aria-label={isSidebarReduced ? 'Expand sidebar details' : 'Reduce sidebar'}
                title={isSidebarReduced ? 'Expand sidebar details' : 'Reduce sidebar'}
              >
                {isSidebarReduced ? 'Expand' : 'Reduce'}
              </button>
            ) : null}
          </div>
          {!isSidebarCollapsed ? (
            <>
          {!isSidebarReduced ? (
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
            </>
          ) : (
            <div className="sidebar-reduced-header">
              <div className="sidebar-filter-title">Sessions</div>
              <button
                type="button"
                className="sidebar-reduced-manage"
                onClick={() => setSidebarMode('full')}
              >
                Show Filters
              </button>
            </div>
          )}
          {selectedAgent === 'none' ? (
            <div className="empty-list">
              {hasAnyConfiguredFolders
                ? 'Choose an agent from the main panel to load conversations.'
                : 'Choose an agent filter to load conversations.'}
            </div>
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
        <section className="detail-panel" ref={detailPanelRef}>
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
