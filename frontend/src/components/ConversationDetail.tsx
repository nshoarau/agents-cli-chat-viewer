import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, useDynamicRowHeight, type ListImperativeAPI } from 'react-window';
import { AxiosError } from 'axios';
import type { ActivityToolCall, Conversation, ConversationFilePreview } from '../types';
import { apiClient } from '../services/apiClient';
import { ConversationDetailHeader } from './ConversationDetailHeader';
import { VirtualizedConversationRow } from './VirtualizedConversationRow';
import {
  buildActivitySummary,
  buildTranscriptMarkdown,
  loadConversationDetailPreferences,
  persistConversationDetailPreferences,
  toConversationExportFileStem,
} from './conversationDetailUtils';
import { buildConversationFileGroups } from './conversationFilesPanelUtils';
import { ConversationFilesPanel } from './ConversationFilesPanel';
import { ConversationFilesModal } from './ConversationFilesModal';
import { FileViewerModal } from './FileViewerModal';

interface ConversationDetailProps {
  conversation?: Conversation;
  isLoading: boolean;
  onShowToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  onConversationDeleted: (deletedId: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onSetSidebarCollapsed: (collapsed: boolean) => void;
}

interface AgentActivityGroup {
  toolCalls: ActivityToolCall[];
  commands: string[];
  filesTouched: string[];
}

const normalizeSearchableText = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~#>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const ConversationDetail: React.FC<ConversationDetailProps> = ({
  conversation,
  isLoading,
  onShowToast,
  onConversationDeleted,
  isSidebarCollapsed,
  onToggleSidebar,
  onSetSidebarCollapsed,
}) => {
  const conversationId = conversation?.id ?? '__no-conversation__';
  const lastAutoScrolledSearchRef = useRef<Record<string, string>>({});
  const exactScrollFrameRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<ListImperativeAPI | null>(null);
  const initialPreferences = useMemo(() => loadConversationDetailPreferences(), []);
  const [sessionActivityVisibility, setSessionActivityVisibility] = useState<Record<string, boolean>>(
    initialPreferences.sessionActivityVisibility
  );
  const [agentActivityVisibility, setAgentActivityVisibility] = useState<Record<string, boolean>>(
    initialPreferences.agentActivityVisibility
  );
  const [filesPanelVisibility, setFilesPanelVisibility] = useState<Record<string, boolean>>(
    initialPreferences.filesPanelVisibility
  );
  const [promptNavigationIndex, setPromptNavigationIndex] = useState<Record<string, number>>(
    initialPreferences.promptNavigationIndex
  );
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<Record<string, string>>(
    {}
  );
  const [searchNavigationIndex, setSearchNavigationIndex] = useState<Record<string, number>>(
    initialPreferences.searchNavigationIndex
  );
  const [editorSelection, setEditorSelection] = useState(initialPreferences.editorSelection);
  const [jetbrainsProduct, setJetbrainsProduct] = useState(initialPreferences.jetbrainsProduct);
  const [jetbrainsProjectName, setJetbrainsProjectName] = useState(initialPreferences.jetbrainsProjectName);
  const [promptHighlightActive, setPromptHighlightActive] = useState<Record<string, boolean>>({});
  const [filePreviewPath, setFilePreviewPath] = useState<string | null>(null);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [filePreview, setFilePreview] = useState<ConversationFilePreview | null>(null);
  const [filePreviewError, setFilePreviewError] = useState<string | null>(null);
  const [isFilePreviewLoading, setIsFilePreviewLoading] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(initialPreferences.headerCollapsed);
  const rowHeightCache = useDynamicRowHeight({
    defaultRowHeight: 240,
    key: conversationId,
  });
  const conversationMessages = useMemo(() => conversation?.messages ?? [], [conversation]);

  useEffect(() => {
    persistConversationDetailPreferences({
      sessionActivityVisibility,
      agentActivityVisibility,
      filesPanelVisibility,
      promptNavigationIndex,
      searchNavigationIndex,
      editorSelection,
      jetbrainsProduct,
      jetbrainsProjectName,
      headerCollapsed: isHeaderCollapsed,
      sidebarCollapsed: isSidebarCollapsed,
    });
  }, [
    editorSelection,
    jetbrainsProduct,
    jetbrainsProjectName,
    agentActivityVisibility,
    filesPanelVisibility,
    isHeaderCollapsed,
    isSidebarCollapsed,
    promptNavigationIndex,
    searchNavigationIndex,
    sessionActivityVisibility,
  ]);

  const userPromptIndexes = useMemo(
    () =>
      conversationMessages.reduce<number[]>((indexes, message, index) => {
        if (message.sender === 'user') {
          indexes.push(index);
        }
        return indexes;
      }, []),
    [conversationMessages]
  );

  const activeSearchQuery = searchQuery[conversationId] ?? '';
  const normalizedSearchQuery = (debouncedSearchQuery[conversationId] ?? '').trim().toLocaleLowerCase();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery((current) => {
        if (current[conversationId] === activeSearchQuery) {
          return current;
        }

        return {
          ...current,
          [conversationId]: activeSearchQuery,
        };
      });
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [activeSearchQuery, conversationId]);

  const normalizedMessageTexts = useMemo(
    () => conversationMessages.map((message) => normalizeSearchableText(message.content)),
    [conversationMessages]
  );

  const searchMatchIndexes = useMemo(
    () => {
      if (!normalizedSearchQuery) {
        return [];
      }

      const pattern = new RegExp(`(^|\\b)${escapeRegExp(normalizedSearchQuery)}(\\b|$)`, 'i');

      return normalizedMessageTexts.reduce<number[]>((indexes, messageText, index) => {
        if (pattern.test(messageText)) {
          indexes.push(index);
        }
        return indexes;
      }, []);
    },
    [normalizedMessageTexts, normalizedSearchQuery]
  );
  const agentMessageIndexes = useMemo(
    () =>
      conversationMessages.reduce<number[]>((indexes, message, index) => {
        if (message.sender === 'agent') {
          indexes.push(index);
        }
        return indexes;
      }, []),
    [conversationMessages]
  );
  const activePromptPosition = Math.min(
    promptNavigationIndex[conversationId] ?? 0,
    Math.max(userPromptIndexes.length - 1, 0)
  );
  const activePromptIndex = promptHighlightActive[conversationId]
    ? userPromptIndexes[activePromptPosition]
    : undefined;
  const activeSearchPosition = Math.min(
    searchNavigationIndex[conversationId] ?? 0,
    Math.max(searchMatchIndexes.length - 1, 0)
  );
  const activeSearchTargetIndex = searchMatchIndexes[activeSearchPosition];

  useEffect(() => {
    return () => {
      if (exactScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(exactScrollFrameRef.current);
      }
    };
  }, []);

  const scrollMessageIntoExactView = useCallback((
    messageIndex: number,
    options?: {
      align?: ScrollLogicalPosition;
      behavior?: ScrollBehavior;
    }
  ) => {
    if (exactScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(exactScrollFrameRef.current);
    }

    const align = options?.align ?? 'start';
    const behavior = options?.behavior ?? 'smooth';
    let attempts = 0;

    const syncScroll = () => {
      const listElement = listRef.current?.element;
      const target = listElement?.querySelector<HTMLElement>(`[data-message-index="${messageIndex}"]`);

      if (listElement && target) {
        const listBounds = listElement.getBoundingClientRect();
        const targetBounds = target.getBoundingClientRect();
        const currentScrollTop = listElement.scrollTop;
        const targetTop = currentScrollTop + (targetBounds.top - listBounds.top);
        const targetCenter = targetTop - (listElement.clientHeight - targetBounds.height) / 2;
        const maxScrollTop = Math.max(listElement.scrollHeight - listElement.clientHeight, 0);
        const nextScrollTop =
          align === 'center'
            ? targetCenter
            : align === 'end'
              ? targetTop - (listElement.clientHeight - targetBounds.height)
              : targetTop;

        listElement.scrollTo({
          top: Math.min(Math.max(nextScrollTop, 0), maxScrollTop),
          behavior,
        });
        exactScrollFrameRef.current = null;
        return;
      }

      if (attempts >= 8) {
        exactScrollFrameRef.current = null;
        return;
      }

      attempts += 1;
      exactScrollFrameRef.current = window.requestAnimationFrame(syncScroll);
    };

    exactScrollFrameRef.current = window.requestAnimationFrame(syncScroll);
  }, [listRef]);

  useEffect(() => {
    if (!normalizedSearchQuery || searchMatchIndexes.length === 0) {
      return;
    }

    if (lastAutoScrolledSearchRef.current[conversationId] === normalizedSearchQuery) {
      return;
    }

    const firstMatchIndex = searchMatchIndexes[0];
    const frameId = window.requestAnimationFrame(() => {
      lastAutoScrolledSearchRef.current[conversationId] = normalizedSearchQuery;
      setSearchNavigationIndex((current) => ({
        ...current,
        [conversationId]: 0,
      }));
      listRef.current?.scrollToRow({
        index: firstMatchIndex,
        behavior: 'auto',
        align: 'start',
      });
      scrollMessageIntoExactView(firstMatchIndex, { align: 'start', behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [conversationId, listRef, normalizedSearchQuery, scrollMessageIntoExactView, searchMatchIndexes]);

  const isMessageOrderDescending =
    conversation && conversationMessages.length > 1
      ? new Date(conversationMessages[0].timestamp || 0).getTime() >=
        new Date(conversationMessages[conversationMessages.length - 1].timestamp || 0).getTime()
      : true;

  const agentActivities = (() => {
    const nextActivities: Record<number, AgentActivityGroup> = {};
    const sessionActivity = conversation?.sessionActivity;

    if (!sessionActivity) {
      return nextActivities;
    }

    agentMessageIndexes.forEach((agentIndex, position) => {
      const agentTimestamp = conversationMessages[agentIndex]?.timestamp;
      const nextMessageTimestamp =
        position < agentMessageIndexes.length - 1
          ? conversationMessages[agentMessageIndexes[position + 1]]?.timestamp
          : undefined;

      const agentTime = agentTimestamp ? new Date(agentTimestamp).getTime() : null;
      const nextMessageTime = nextMessageTimestamp ? new Date(nextMessageTimestamp).getTime() : null;

      const toolCalls = sessionActivity.toolCalls.filter((toolCall) => {
        if (!toolCall.timestamp || agentTime === null) {
          return false;
        }

        const toolTime = new Date(toolCall.timestamp).getTime();
        if (Number.isNaN(toolTime)) {
          return false;
        }

        if (toolTime < agentTime && !isMessageOrderDescending) {
          return false;
        }

        if (isMessageOrderDescending) {
          if (toolTime > agentTime) {
            return false;
          }

          if (nextMessageTime !== null && toolTime <= nextMessageTime) {
            return false;
          }
        } else if (nextMessageTime !== null && toolTime >= nextMessageTime) {
          return false;
        }

        return true;
      });

      nextActivities[agentIndex] = {
        toolCalls,
        commands: [...new Set(toolCalls.map((toolCall) => toolCall.command).filter(Boolean))] as string[],
        filesTouched: [
          ...new Set(toolCalls.map((toolCall) => toolCall.filePath).filter(Boolean)),
        ] as string[],
      };
    });

    return nextActivities;
  })();
  const conversationFileGroups = useMemo(
    () => buildConversationFileGroups(conversation),
    [conversation]
  );
  const rowProps = {
    messages: conversationMessages,
    searchHighlightQuery: normalizedSearchQuery,
    activePromptIndex,
    activeSearchTargetIndex,
    showSessionActivity: sessionActivityVisibility[conversationId] ?? true,
    agentActivities,
    agentActivityVisibility,
    conversationId,
    projectPath: conversation?.projectPath,
    onToggleActivity: (index: number) =>
      setAgentActivityVisibility((current) => ({
        ...current,
        [`${conversationId}:${index}`]: !current[`${conversationId}:${index}`],
      })),
    onShowToast,
    onOpenFile: (filePath: string) => {
      setFilePreviewPath(filePath);
    },
  };

  const showSessionActivity = sessionActivityVisibility[conversationId] ?? true;
  const isFilesPanelExpanded = filesPanelVisibility[conversationId] ?? false;
  const agentActivityKeys = Object.keys(agentActivities).filter(
    (key) => agentActivities[Number(key)]?.toolCalls.length > 0
  );
  const allAgentActivitiesExpanded =
    agentActivityKeys.length > 0 &&
    agentActivityKeys.every((key) => agentActivityVisibility[`${conversationId}:${key}`]);

  const navigateToPrompt = useCallback((nextPosition: number) => {
    const normalizedPosition = Math.max(0, Math.min(nextPosition, userPromptIndexes.length - 1));
    const messageIndex = userPromptIndexes[normalizedPosition];
    if (messageIndex === undefined) {
      return;
    }

    setPromptNavigationIndex((current) => ({
      ...current,
      [conversationId]: normalizedPosition,
    }));
    setPromptHighlightActive((current) => ({
      ...current,
      [conversationId]: true,
    }));
    listRef.current?.scrollToRow({
      index: messageIndex,
      behavior: 'auto',
      align: 'center',
    });
    scrollMessageIntoExactView(messageIndex, { align: 'center', behavior: 'smooth' });
  }, [conversationId, listRef, scrollMessageIntoExactView, userPromptIndexes]);

  const toggleAllAgentActivities = () => {
    setAgentActivityVisibility((current) => {
      const next = { ...current };
      agentActivityKeys.forEach((key) => {
        next[`${conversationId}:${key}`] = !allAgentActivitiesExpanded;
      });
      return next;
    });
  };

  const navigateToSearchMatch = useCallback((nextPosition: number) => {
    const normalizedPosition = Math.max(0, Math.min(nextPosition, searchMatchIndexes.length - 1));
    const messageIndex = searchMatchIndexes[normalizedPosition];
    if (messageIndex === undefined) {
      return;
    }

    setSearchNavigationIndex((current) => ({
      ...current,
      [conversationId]: normalizedPosition,
    }));
    window.requestAnimationFrame(() => {
      listRef.current?.scrollToRow({
        index: messageIndex,
        behavior: 'auto',
        align: 'start',
      });
      scrollMessageIntoExactView(messageIndex, { align: 'start', behavior: 'smooth' });
    });
  }, [conversationId, listRef, scrollMessageIntoExactView, searchMatchIndexes]);

  useEffect(() => {
    if (!conversation) {
      return;
    }

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();

        if (event.shiftKey) {
          navigateToPrompt(activePromptPosition + 1);
          return;
        }

        navigateToSearchMatch(activeSearchPosition + 1);
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();

        if (event.shiftKey) {
          navigateToPrompt(activePromptPosition - 1);
          return;
        }

        navigateToSearchMatch(activeSearchPosition - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePromptPosition,
    activeSearchPosition,
    conversation,
    navigateToPrompt,
    navigateToSearchMatch,
  ]);

  useEffect(() => {
    if (!conversation || !filePreviewPath) {
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      setIsFilePreviewLoading(true);
      setFilePreviewError(null);

      try {
        const response = await apiClient.get<ConversationFilePreview>(
          `/conversations/${conversation.id}/files/content`,
          {
            params: {
              path: filePreviewPath,
            },
          }
        );

        if (!cancelled) {
          setFilePreview(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof AxiosError
              ? error.response?.data?.error || error.message
              : error instanceof Error
                ? error.message
                : 'Failed to load file preview.';
          setFilePreview(null);
          setFilePreviewError(message);
        }
      } finally {
        if (!cancelled) {
          setIsFilePreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [conversation, filePreviewPath]);

  const downloadExport = useCallback(
    (fileName: string, content: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      onShowToast(`${fileName} exported.`);
    },
    [onShowToast]
  );

  if (isLoading) {
    return <div className="detail-placeholder">Loading conversation...</div>;
  }

  if (!conversation) {
    return (
      <div className="detail-placeholder">
        Select a conversation from the list to view its details.
      </div>
    );
  }

  const exportFileStem = toConversationExportFileStem(conversation);

  return (
    <div className={`conversation-detail ${isHeaderCollapsed ? 'conversation-detail-immersive' : ''}`}>
      <ConversationDetailHeader
        conversation={conversation}
        onShowToast={onShowToast}
        onConversationDeleted={onConversationDeleted}
        isHeaderCollapsed={isHeaderCollapsed}
        isSidebarCollapsed={isSidebarCollapsed}
        hasSessionActivity={Boolean(conversation.sessionActivity)}
        showSessionActivity={showSessionActivity}
        hasExpandableActivities={agentActivityKeys.length > 0}
        allAgentActivitiesExpanded={allAgentActivitiesExpanded}
        searchQuery={activeSearchQuery}
        searchInputRef={searchInputRef}
        searchMatchPosition={searchMatchIndexes.length === 0 ? 0 : activeSearchPosition + 1}
        searchMatchCount={searchMatchIndexes.length}
        promptPosition={activePromptPosition + 1}
        promptCount={userPromptIndexes.length}
        editorSelection={editorSelection}
        jetbrainsProduct={jetbrainsProduct}
        jetbrainsProjectName={jetbrainsProjectName}
        onSearchQueryChange={(value) => {
          setSearchQuery((current) => ({
            ...current,
            [conversationId]: value,
          }));
          setSearchNavigationIndex((current) => ({
            ...current,
            [conversationId]: 0,
          }));
        }}
        onPreviousSearchMatch={() => navigateToSearchMatch(activeSearchPosition - 1)}
        onNextSearchMatch={() => navigateToSearchMatch(activeSearchPosition + 1)}
        onToggleSessionActivity={() =>
          setSessionActivityVisibility((current) => ({
            ...current,
            [conversationId]: !(current[conversationId] ?? true),
          }))
        }
        onEditorSelectionChange={setEditorSelection}
        onJetBrainsProductChange={setJetbrainsProduct}
        onJetBrainsProjectNameChange={setJetbrainsProjectName}
        onToggleHeaderCollapsed={() => setIsHeaderCollapsed((current) => !current)}
        onToggleSidebar={onToggleSidebar}
        onToggleFullScreen={() => {
          const nextCollapsed = !(isHeaderCollapsed && isSidebarCollapsed);
          setIsHeaderCollapsed(nextCollapsed);
          onSetSidebarCollapsed(nextCollapsed);
        }}
        onToggleAllActivities={toggleAllAgentActivities}
        hasFiles={conversationFileGroups.length > 0}
        onOpenFilesModal={() => setIsFilesModalOpen(true)}
        onPreviousPrompt={() => navigateToPrompt(activePromptPosition - 1)}
        onNextPrompt={() => navigateToPrompt(activePromptPosition + 1)}
        onExportJson={() =>
          downloadExport(
            `${exportFileStem}.json`,
            JSON.stringify(conversation, null, 2),
            'application/json'
          )
        }
        onExportMarkdown={() =>
          downloadExport(
            `${exportFileStem}.md`,
            buildTranscriptMarkdown(conversation),
            'text/markdown;charset=utf-8'
          )
        }
        onExportActivity={() =>
          downloadExport(
            `${exportFileStem}-activity.txt`,
            buildActivitySummary(conversation),
            'text/plain;charset=utf-8'
          )
        }
        disablePreviousSearchMatch={searchMatchIndexes.length === 0 || activeSearchPosition === 0}
        disableNextSearchMatch={
          searchMatchIndexes.length === 0 || activeSearchPosition >= searchMatchIndexes.length - 1
        }
        disablePreviousPrompt={activePromptPosition === 0}
        disableNextPrompt={activePromptPosition >= userPromptIndexes.length - 1}
      />
      {!isHeaderCollapsed ? (
        <ConversationFilesPanel
          groups={conversationFileGroups}
          isExpanded={isFilesPanelExpanded}
          onOpenFullList={() => setIsFilesModalOpen(true)}
          onToggleExpanded={() =>
            setFilesPanelVisibility((current) => ({
              ...current,
              [conversationId]: !(current[conversationId] ?? false),
            }))
          }
          onOpenFile={(filePath) => {
            setFilePreviewPath(filePath);
          }}
        />
      ) : null}
      <div className="message-list">
        <List
          className="message-list-virtualized"
          defaultHeight={720}
          listRef={listRef}
          rowComponent={VirtualizedConversationRow}
          rowCount={conversation.messages.length}
          rowHeight={rowHeightCache}
          rowProps={rowProps}
          overscanCount={4}
          style={{ height: '100%' }}
        />
      </div>
      {filePreviewPath ? (
        <FileViewerModal
          filePath={filePreviewPath}
          resolvedPath={filePreview?.filePath}
          editorPath={filePreview?.editorPath}
          selectedEditor={editorSelection}
          jetbrainsProduct={jetbrainsProduct}
          jetbrainsProjectName={jetbrainsProjectName}
          projectPath={conversation.projectPath}
          content={filePreview?.content ?? ''}
          truncated={Boolean(filePreview?.truncated)}
          previewStatus={filePreview?.previewStatus}
          previewMessage={filePreview?.previewMessage}
          rawUrl={filePreview?.rawUrl}
          isLoading={isFilePreviewLoading}
          error={filePreviewError ?? undefined}
          onClose={() => {
            setFilePreviewPath(null);
            setFilePreview(null);
            setFilePreviewError(null);
            setIsFilePreviewLoading(false);
          }}
        />
      ) : null}
      {isFilesModalOpen ? (
        <ConversationFilesModal
          groups={conversationFileGroups}
          onOpenFile={(filePath) => {
            setIsFilesModalOpen(false);
            setFilePreviewPath(filePath);
          }}
          onClose={() => setIsFilesModalOpen(false)}
        />
      ) : null}
    </div>
  );
};
