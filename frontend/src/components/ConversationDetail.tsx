import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityToolCall, Conversation } from '../types';
import { ConversationDetailHeader } from './ConversationDetailHeader';
import { ConversationMessageBubble } from './ConversationMessageBubble';

interface ConversationDetailProps {
  conversation?: Conversation;
  isLoading: boolean;
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
}) => {
  const conversationId = conversation?.id ?? '__no-conversation__';
  const lastAutoScrolledSearchRef = useRef<Record<string, string>>({});
  const [sessionActivityVisibility, setSessionActivityVisibility] = useState<Record<string, boolean>>(
    {}
  );
  const [agentActivityVisibility, setAgentActivityVisibility] = useState<Record<string, boolean>>(
    {}
  );
  const [promptNavigationIndex, setPromptNavigationIndex] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<Record<string, string>>({});
  const [searchNavigationIndex, setSearchNavigationIndex] = useState<Record<string, number>>({});
  const userPromptRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const userPromptIndexes = useMemo(
    () =>
      (conversation?.messages ?? []).reduce<number[]>((indexes, message, index) => {
        if (message.sender === 'user') {
          indexes.push(index);
        }
        return indexes;
      }, []),
    [conversation?.messages]
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
    () =>
      (conversation?.messages ?? []).map((message) => normalizeSearchableText(message.content)),
    [conversation?.messages]
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
      (conversation?.messages ?? []).reduce<number[]>((indexes, message, index) => {
        if (message.sender === 'agent') {
          indexes.push(index);
        }
        return indexes;
      }, []),
    [conversation?.messages]
  );

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
      messageRefs.current[firstMatchIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [conversationId, normalizedSearchQuery, searchMatchIndexes]);

  const agentActivities: Record<number, AgentActivityGroup> = {};
  const isMessageOrderDescending =
    conversation && conversation.messages.length > 1
      ? new Date(conversation.messages[0].timestamp || 0).getTime() >=
        new Date(conversation.messages[conversation.messages.length - 1].timestamp || 0).getTime()
      : true;

  if (conversation?.sessionActivity) {
    agentMessageIndexes.forEach((agentIndex, position) => {
      const agentTimestamp = conversation.messages[agentIndex]?.timestamp;
      const nextMessageTimestamp =
        position < agentMessageIndexes.length - 1
          ? conversation.messages[agentMessageIndexes[position + 1]]?.timestamp
          : undefined;

      const agentTime = agentTimestamp ? new Date(agentTimestamp).getTime() : null;
      const nextMessageTime = nextMessageTimestamp ? new Date(nextMessageTimestamp).getTime() : null;

      const toolCalls = conversation.sessionActivity.toolCalls.filter((toolCall) => {
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

      agentActivities[agentIndex] = {
        toolCalls,
        commands: [...new Set(toolCalls.map((toolCall) => toolCall.command).filter(Boolean))] as string[],
        filesTouched: [
          ...new Set(toolCalls.map((toolCall) => toolCall.filePath).filter(Boolean)),
        ] as string[],
      };
    });
  }

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

  const showSessionActivity = sessionActivityVisibility[conversationId] ?? true;
  const agentActivityKeys = Object.keys(agentActivities).filter(
    (key) => agentActivities[Number(key)]?.toolCalls.length > 0
  );
  const allAgentActivitiesExpanded =
    agentActivityKeys.length > 0 &&
    agentActivityKeys.every((key) => agentActivityVisibility[`${conversationId}:${key}`]);
  const activePromptPosition = Math.min(
    promptNavigationIndex[conversationId] ?? 0,
    Math.max(userPromptIndexes.length - 1, 0)
  );
  const activePromptIndex = userPromptIndexes[activePromptPosition];
  const activeSearchPosition = Math.min(
    searchNavigationIndex[conversationId] ?? 0,
    Math.max(searchMatchIndexes.length - 1, 0)
  );
  const activeSearchTargetIndex = searchMatchIndexes[activeSearchPosition];

  const navigateToPrompt = (nextPosition: number) => {
    const normalizedPosition = Math.max(0, Math.min(nextPosition, userPromptIndexes.length - 1));
    const messageIndex = userPromptIndexes[normalizedPosition];
    if (messageIndex === undefined) {
      return;
    }

    setPromptNavigationIndex((current) => ({
      ...current,
      [conversationId]: normalizedPosition,
    }));
    userPromptRefs.current[messageIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const toggleAllAgentActivities = () => {
    setAgentActivityVisibility((current) => {
      const next = { ...current };
      agentActivityKeys.forEach((key) => {
        next[`${conversationId}:${key}`] = !allAgentActivitiesExpanded;
      });
      return next;
    });
  };

  const navigateToSearchMatch = (nextPosition: number) => {
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
      messageRefs.current[messageIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const setMessageRef = (index: number, element: HTMLDivElement | null, isUserPrompt: boolean) => {
    messageRefs.current[index] = element;
    if (isUserPrompt) {
      userPromptRefs.current[index] = element;
    }
  };

  return (
    <div className="conversation-detail">
      <ConversationDetailHeader
        conversation={conversation}
        hasSessionActivity={Boolean(conversation.sessionActivity)}
        showSessionActivity={showSessionActivity}
        hasExpandableActivities={agentActivityKeys.length > 0}
        allAgentActivitiesExpanded={allAgentActivitiesExpanded}
        searchQuery={activeSearchQuery}
        searchMatchPosition={searchMatchIndexes.length === 0 ? 0 : activeSearchPosition + 1}
        searchMatchCount={searchMatchIndexes.length}
        promptPosition={activePromptPosition + 1}
        promptCount={userPromptIndexes.length}
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
        onToggleAllActivities={toggleAllAgentActivities}
        onPreviousPrompt={() => navigateToPrompt(activePromptPosition - 1)}
        onNextPrompt={() => navigateToPrompt(activePromptPosition + 1)}
        disablePreviousSearchMatch={searchMatchIndexes.length === 0 || activeSearchPosition === 0}
        disableNextSearchMatch={
          searchMatchIndexes.length === 0 || activeSearchPosition >= searchMatchIndexes.length - 1
        }
        disablePreviousPrompt={activePromptPosition === 0}
        disableNextPrompt={activePromptPosition >= userPromptIndexes.length - 1}
      />
      <div className="message-list">
        {conversation.messages.map((message, index) => (
          <ConversationMessageBubble
            key={index}
            message={message}
            isPromptTarget={message.sender === 'user' && index === activePromptIndex}
            isActiveSearchTarget={index === activeSearchTargetIndex}
            showSessionActivity={showSessionActivity}
            activity={agentActivities[index]}
            isActivityExpanded={Boolean(agentActivityVisibility[`${conversationId}:${index}`])}
            onToggleActivity={() =>
              setAgentActivityVisibility((current) => ({
                ...current,
                [`${conversationId}:${index}`]: !current[`${conversationId}:${index}`],
              }))
            }
            setUserPromptRef={(element) => setMessageRef(index, element, message.sender === 'user')}
          />
        ))}
      </div>
    </div>
  );
};
