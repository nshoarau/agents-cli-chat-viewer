import React from 'react';
import type { Conversation } from '../types';
import { AgentIcon } from './AgentIcon';
import { ConversationActions } from './ConversationActions';

interface ConversationDetailHeaderProps {
  conversation: Conversation;
  onShowToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  onConversationDeleted: (deletedId: string) => void;
  hasSessionActivity: boolean;
  showSessionActivity: boolean;
  hasExpandableActivities: boolean;
  allAgentActivitiesExpanded: boolean;
  searchQuery: string;
  searchMatchPosition: number;
  searchMatchCount: number;
  promptPosition: number;
  promptCount: number;
  onSearchQueryChange: (value: string) => void;
  onPreviousSearchMatch: () => void;
  onNextSearchMatch: () => void;
  onToggleSessionActivity: () => void;
  onToggleAllActivities: () => void;
  onPreviousPrompt: () => void;
  onNextPrompt: () => void;
  disablePreviousSearchMatch: boolean;
  disableNextSearchMatch: boolean;
  disablePreviousPrompt: boolean;
  disableNextPrompt: boolean;
}

export const ConversationDetailHeader: React.FC<ConversationDetailHeaderProps> = ({
  conversation,
  onShowToast,
  onConversationDeleted,
  hasSessionActivity,
  showSessionActivity,
  hasExpandableActivities,
  allAgentActivitiesExpanded,
  searchQuery,
  searchMatchPosition,
  searchMatchCount,
  promptPosition,
  promptCount,
  onSearchQueryChange,
  onPreviousSearchMatch,
  onNextSearchMatch,
  onToggleSessionActivity,
  onToggleAllActivities,
  onPreviousPrompt,
  onNextPrompt,
  disablePreviousSearchMatch,
  disableNextSearchMatch,
  disablePreviousPrompt,
  disableNextPrompt,
}) => {
  return (
    <div className="detail-header">
      <div className="header-top">
        <h2>{conversation.title}</h2>
        <ConversationActions
          conversation={conversation}
          onShowToast={onShowToast}
          onConversationDeleted={onConversationDeleted}
        />
      </div>
      <div className="detail-meta">
        <div className="detail-meta-primary">
          <span className={`agent-badge agent-${conversation.agentType}`}>
            <AgentIcon agent={conversation.agentType} />
          </span>
          <span className="detail-date">{new Date(conversation.timestamp).toLocaleString()}</span>
          {conversation.status === 'archived' ? <span className="status-badge">Archived</span> : null}
        </div>
        <div className="detail-utility-strip">
          <input
            type="search"
            className="transcript-search-input"
            placeholder="Search this conversation"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
          <div className="transcript-search">
            <span className="detail-control-label">Matches</span>
            <div className="transcript-search-controls">
              <button
                type="button"
                className="btn-prompt-nav btn-compact-nav"
                onClick={onPreviousSearchMatch}
                disabled={disablePreviousSearchMatch}
                aria-label="Previous search match"
                title="Previous search match"
              >
                ↑
              </button>
              <span className="prompt-navigation-status">
                {searchMatchCount === 0 ? '0 / 0' : `${searchMatchPosition} / ${searchMatchCount}`}
              </span>
              <button
                type="button"
                className="btn-prompt-nav btn-compact-nav"
                onClick={onNextSearchMatch}
                disabled={disableNextSearchMatch}
                aria-label="Next search match"
                title="Next search match"
              >
                ↓
              </button>
            </div>
          </div>
          {promptCount > 0 ? (
            <div className="prompt-navigation">
              <span className="detail-control-label">Prompts</span>
              <div className="transcript-search-controls">
                <button
                  type="button"
                  className="btn-prompt-nav btn-compact-nav"
                  onClick={onPreviousPrompt}
                  disabled={disablePreviousPrompt}
                  aria-label="Previous prompt"
                  title="Previous prompt"
                >
                  ↑
                </button>
                <span className="prompt-navigation-status">
                  {promptPosition} / {promptCount}
                </span>
                <button
                  type="button"
                  className="btn-prompt-nav btn-compact-nav"
                  onClick={onNextPrompt}
                  disabled={disableNextPrompt}
                  aria-label="Next prompt"
                  title="Next prompt"
                >
                  ↓
                </button>
              </div>
            </div>
          ) : null}
          {hasSessionActivity ? (
            <button
              type="button"
              className="btn-session-activity-toggle"
              onClick={onToggleSessionActivity}
            >
              {showSessionActivity ? 'Hide Activity' : 'Show Activity'}
            </button>
          ) : null}
          {showSessionActivity && hasExpandableActivities ? (
            <button type="button" className="btn-session-activity-toggle" onClick={onToggleAllActivities}>
              {allAgentActivitiesExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
