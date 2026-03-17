import React from 'react';
import type { CSSProperties } from 'react';
import type { RowComponentProps } from 'react-window';
import type { ActivityToolCall, Message } from '../types';
import { ConversationMessageBubble } from './ConversationMessageBubble';

export interface VirtualizedConversationRowData {
  messages: Message[];
  searchHighlightQuery: string;
  onShowToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  activePromptIndex?: number;
  activeSearchTargetIndex?: number;
  showSessionActivity: boolean;
  agentActivities: Record<
    number,
    {
      toolCalls: ActivityToolCall[];
      commands: string[];
      filesTouched: string[];
    }
  >;
  agentActivityVisibility: Record<string, boolean>;
  conversationId: string;
  onToggleActivity: (index: number) => void;
}

type VirtualizedConversationRowProps = RowComponentProps<VirtualizedConversationRowData>;

const rowStyle: CSSProperties = {
  paddingBottom: '24px',
};

export function VirtualizedConversationRow({
  ariaAttributes,
  index,
  style,
  messages,
  searchHighlightQuery,
  onShowToast,
  activePromptIndex,
  activeSearchTargetIndex,
  showSessionActivity,
  agentActivities,
  agentActivityVisibility,
  conversationId,
  onToggleActivity,
}: VirtualizedConversationRowProps): React.JSX.Element | null {
  const message = messages[index];
  if (!message) {
    return null;
  }

  return (
    <div aria-label={ariaAttributes['aria-posinset']?.toString()} role={ariaAttributes.role} style={{ ...style, ...rowStyle }}>
      <ConversationMessageBubble
        message={message}
        messageIndex={index}
        searchHighlightQuery={searchHighlightQuery}
        onShowToast={onShowToast}
        isPromptTarget={message.sender === 'user' && index === activePromptIndex}
        isActiveSearchTarget={index === activeSearchTargetIndex}
        showSessionActivity={showSessionActivity}
        activity={agentActivities[index]}
        isActivityExpanded={Boolean(agentActivityVisibility[`${conversationId}:${index}`])}
        onToggleActivity={() => onToggleActivity(index)}
      />
    </div>
  );
}
