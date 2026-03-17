import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import type { ActivityToolCall, Message } from '../types';
import { CodeBlock } from './CodeBlock';
import { ConversationActivityPanel } from './ConversationActivityPanel';

interface ConversationMessageBubbleProps {
  message: Message;
  messageIndex: number;
  searchHighlightQuery?: string;
  onShowToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightTextChildren = (children: React.ReactNode, query: string): React.ReactNode => {
  if (!query.trim()) {
    return children;
  }

  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  const lowerQuery = query.toLocaleLowerCase();

  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const segments = child.split(pattern);

      if (segments.length === 1) {
        return child;
      }

      return segments.map((segment, index) =>
        segment.toLocaleLowerCase() === lowerQuery ? (
          <mark key={`${segment}-${index}`} className="message-search-highlight">
            {segment}
          </mark>
        ) : (
          segment
        )
      );
    }

    if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      return React.cloneElement(child, undefined, highlightTextChildren(child.props.children, query));
    }

    return child;
  });
};

const createMarkdownComponents = (searchHighlightQuery: string): Components => ({
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
  p({ children, ...props }) {
    return <p {...props}>{highlightTextChildren(children, searchHighlightQuery)}</p>;
  },
  li({ children, ...props }) {
    return <li {...props}>{highlightTextChildren(children, searchHighlightQuery)}</li>;
  },
  blockquote({ children, ...props }) {
    return <blockquote {...props}>{highlightTextChildren(children, searchHighlightQuery)}</blockquote>;
  },
  a({ children, ...props }) {
    return <a {...props}>{highlightTextChildren(children, searchHighlightQuery)}</a>;
  },
  strong({ children, ...props }) {
    return <strong {...props}>{highlightTextChildren(children, searchHighlightQuery)}</strong>;
  },
  em({ children, ...props }) {
    return <em {...props}>{highlightTextChildren(children, searchHighlightQuery)}</em>;
  },
  h1({ children, ...props }) {
    return <h1 {...props}>{highlightTextChildren(children, searchHighlightQuery)}</h1>;
  },
  h2({ children, ...props }) {
    return <h2 {...props}>{highlightTextChildren(children, searchHighlightQuery)}</h2>;
  },
  h3({ children, ...props }) {
    return <h3 {...props}>{highlightTextChildren(children, searchHighlightQuery)}</h3>;
  },
  h4({ children, ...props }) {
    return <h4 {...props}>{highlightTextChildren(children, searchHighlightQuery)}</h4>;
  },
  h5({ children, ...props }) {
    return <h5 {...props}>{highlightTextChildren(children, searchHighlightQuery)}</h5>;
  },
  h6({ children, ...props }) {
    return <h6 {...props}>{highlightTextChildren(children, searchHighlightQuery)}</h6>;
  },
});

export const ConversationMessageBubble: React.FC<ConversationMessageBubbleProps> = ({
  message,
  messageIndex,
  searchHighlightQuery,
  onShowToast,
  isPromptTarget,
  isActiveSearchTarget,
  showSessionActivity,
  activity,
  isActivityExpanded,
  onToggleActivity,
}) => {
  const hasActivity = message.sender === 'agent' && activity && activity.toolCalls.length > 0;
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const resetTimerRef = useRef<number | null>(null);
  const markdownComponents = createMarkdownComponents(searchHighlightQuery ?? '');

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!navigator.clipboard) {
      setCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(message.content);
      setCopyState('copied');
      onShowToast('Message copied.');
    } catch {
      setCopyState('error');
      onShowToast('Failed to copy message.', 'error');
    }

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      resetTimerRef.current = null;
    }, 1600);
  };

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
          <button
            type="button"
            className={`message-copy-button ${copyState !== 'idle' ? `is-${copyState}` : ''}`}
            onClick={handleCopy}
            aria-label={copyState === 'copied' ? 'Message copied' : 'Copy message text'}
            title={
              copyState === 'copied'
                ? 'Copied'
                : copyState === 'error'
                  ? 'Copy failed'
                  : 'Copy message text'
            }
          >
            {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Retry' : 'Copy'}
          </button>
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
