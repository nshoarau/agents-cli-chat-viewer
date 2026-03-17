import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import type { ActivityToolCall, Message } from '../types';
import { CodeBlock } from './CodeBlock';
import { ConversationActivityPanel } from './ConversationActivityPanel';

interface ConversationMessageBubbleProps {
  message: Message;
  messageIndex: number;
  isPromptTarget: boolean;
  isActiveSearchTarget: boolean;
  showSessionActivity: boolean;
  activity?: {
    toolCalls: ActivityToolCall[];
    commands: string[];
    filesTouched: string[];
  };
  isActivityExpanded: boolean;
  onToggleActivity: () => void;
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');

    return match ? (
      <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} {...props} />
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export const ConversationMessageBubble: React.FC<ConversationMessageBubbleProps> = ({
  message,
  messageIndex,
  isPromptTarget,
  isActiveSearchTarget,
  showSessionActivity,
  activity,
  isActivityExpanded,
  onToggleActivity,
}) => {
  const hasActivity = message.sender === 'agent' && activity && activity.toolCalls.length > 0;

  return (
    <div
      data-message-index={messageIndex}
      className={`message-bubble ${message.sender} ${
        message.sender === 'user' && isPromptTarget ? 'prompt-target' : ''
      } ${isActiveSearchTarget ? 'search-target-active' : ''}`}
    >
      <div className={`message-header ${message.sender === 'user' ? 'message-header-user' : ''}`}>
        <div className="message-sender">{message.sender === 'user' ? 'You' : 'Agent'}</div>
        <div className="message-header-actions">
          {message.timestamp ? (
            <div className="message-time">{new Date(message.timestamp).toLocaleString()}</div>
          ) : null}
        </div>
      </div>
      <div className="message-content">
        <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
      </div>
      {showSessionActivity && hasActivity ? (
        <div className="message-activity-footer">
          <button type="button" className="btn-prompt-activity-toggle" onClick={onToggleActivity}>
            {isActivityExpanded ? 'Hide Activity' : `Show Activity (${activity.toolCalls.length})`}
          </button>
        </div>
      ) : null}
      {showSessionActivity && hasActivity && isActivityExpanded ? (
        <ConversationActivityPanel
          commands={activity.commands}
          filesTouched={activity.filesTouched}
          toolCalls={activity.toolCalls}
        />
      ) : null}
    </div>
  );
};
