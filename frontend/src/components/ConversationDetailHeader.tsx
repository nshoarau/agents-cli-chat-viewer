import React from 'react';
import type { Conversation } from '../types';
import { AgentIcon } from './AgentIcon';
import { ConversationActions } from './ConversationActions';

interface ConversationDetailHeaderProps {
  conversation: Conversation;
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
        <ConversationActions conversation={conversation} />
      </div>
      <div className="detail-meta">
        <span className={`agent-badge agent-${conversation.agentType}`}>
          <AgentIcon agent={conversation.agentType} />
        </span>
        <span className="detail-date">{new Date(conversation.timestamp).toLocaleString()}</span>
        {conversation.status === 'archived' ? <span className="status-badge">Archived</span> : null}
        {hasSessionActivity ? (
          <button type="button" className="btn-session-activity-toggle" onClick={onToggleSessionActivity}>
            {showSessionActivity ? 'Hide Session Activity' : 'Show Session Activity'}
          </button>
        ) : null}
        {showSessionActivity && hasExpandableActivities ? (
          <button type="button" className="btn-session-activity-toggle" onClick={onToggleAllActivities}>
            {allAgentActivitiesExpanded ? 'Collapse All Activities' : 'Expand All Activities'}
          </button>
        ) : null}
        <div className="transcript-search">
          <input
            type="search"
            className="transcript-search-input"
            placeholder="Search this conversation"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
          <div className="transcript-search-controls">
            <button
              type="button"
              className="btn-prompt-nav"
              onClick={onPreviousSearchMatch}
              disabled={disablePreviousSearchMatch}
            >
              Previous Match
            </button>
            <span className="prompt-navigation-status">
              {searchMatchCount === 0 ? '0 / 0' : `${searchMatchPosition} / ${searchMatchCount}`}
            </span>
            <button
              type="button"
              className="btn-prompt-nav"
              onClick={onNextSearchMatch}
              disabled={disableNextSearchMatch}
            >
              Next Match
            </button>
          </div>
        </div>
        {promptCount > 0 ? (
          <div className="prompt-navigation">
            <button
              type="button"
              className="btn-prompt-nav"
              onClick={onPreviousPrompt}
              disabled={disablePreviousPrompt}
            >
              Previous Prompt
            </button>
            <span className="prompt-navigation-status">
              {promptPosition} / {promptCount}
            </span>
            <button
              type="button"
              className="btn-prompt-nav"
              onClick={onNextPrompt}
              disabled={disableNextPrompt}
            >
              Next Prompt
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
