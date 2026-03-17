import React, { useEffect, useRef, useState } from 'react';
import type { Conversation } from '../types';
import { AgentIcon } from './AgentIcon';
import { ConversationActions } from './ConversationActions';
import {
  EDITOR_OPTIONS,
  JETBRAINS_PRODUCT_OPTIONS,
  type EditorOptionId,
  type JetBrainsProductId,
} from './fileEditorLink';

const EyeIcon = () => <span aria-hidden="true">◉</span>;
const LayersIcon = () => <span aria-hidden="true">▥</span>;
const ExportIcon = () => <span aria-hidden="true">↧</span>;
const EditorIcon = () => <span aria-hidden="true">⌘</span>;

interface ConversationDetailHeaderProps {
  conversation: Conversation;
  onShowToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
  onConversationDeleted: (deletedId: string) => void;
  isHeaderCollapsed: boolean;
  isSidebarCollapsed: boolean;
  hasSessionActivity: boolean;
  showSessionActivity: boolean;
  hasExpandableActivities: boolean;
  allAgentActivitiesExpanded: boolean;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchMatchPosition: number;
  searchMatchCount: number;
  promptPosition: number;
  promptCount: number;
  editorSelection: EditorOptionId;
  jetbrainsProduct: JetBrainsProductId;
  jetbrainsProjectName: string;
  onSearchQueryChange: (value: string) => void;
  onPreviousSearchMatch: () => void;
  onNextSearchMatch: () => void;
  onToggleHeaderCollapsed: () => void;
  onToggleSidebar: () => void;
  onToggleFullScreen: () => void;
  onToggleSessionActivity: () => void;
  onEditorSelectionChange: (value: EditorOptionId) => void;
  onJetBrainsProductChange: (value: JetBrainsProductId) => void;
  onJetBrainsProjectNameChange: (value: string) => void;
  onToggleAllActivities: () => void;
  onPreviousPrompt: () => void;
  onNextPrompt: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportActivity: () => void;
  disablePreviousSearchMatch: boolean;
  disableNextSearchMatch: boolean;
  disablePreviousPrompt: boolean;
  disableNextPrompt: boolean;
}

export const ConversationDetailHeader: React.FC<ConversationDetailHeaderProps> = ({
  conversation,
  onShowToast,
  onConversationDeleted,
  isHeaderCollapsed,
  isSidebarCollapsed,
  hasSessionActivity,
  showSessionActivity,
  hasExpandableActivities,
  allAgentActivitiesExpanded,
  searchQuery,
  searchInputRef,
  searchMatchPosition,
  searchMatchCount,
  promptPosition,
  promptCount,
  editorSelection,
  jetbrainsProduct,
  jetbrainsProjectName,
  onSearchQueryChange,
  onPreviousSearchMatch,
  onNextSearchMatch,
  onToggleHeaderCollapsed,
  onToggleSidebar,
  onToggleFullScreen,
  onToggleSessionActivity,
  onEditorSelectionChange,
  onJetBrainsProductChange,
  onJetBrainsProjectNameChange,
  onToggleAllActivities,
  onPreviousPrompt,
  onNextPrompt,
  onExportJson,
  onExportMarkdown,
  onExportActivity,
  disablePreviousSearchMatch,
  disableNextSearchMatch,
  disablePreviousPrompt,
  disableNextPrompt,
}) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const editorMenuRef = useRef<HTMLDivElement | null>(null);
  const isFullScreen = isHeaderCollapsed && isSidebarCollapsed;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (!editorMenuRef.current?.contains(event.target as Node)) {
        setIsEditorMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className={`detail-header ${isHeaderCollapsed ? 'detail-header-collapsed' : ''}`}>
      <div className="header-top">
        <h2>{conversation.title}</h2>
        <div className="detail-header-actions">
          {!isFullScreen ? (
            <button
              type="button"
              className="btn-session-activity-toggle"
              onClick={onToggleSidebar}
            >
              {isSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-session-activity-toggle"
            onClick={onToggleFullScreen}
          >
            {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
          {!isFullScreen ? (
            <button
              type="button"
              className="btn-session-activity-toggle"
              onClick={onToggleHeaderCollapsed}
            >
              {isHeaderCollapsed ? 'Show Controls' : 'Focus Transcript'}
            </button>
          ) : null}
          <div className="export-menu" ref={exportMenuRef}>
            <button
              type="button"
              className="btn-session-activity-toggle btn-export-toggle"
              onClick={() => setIsExportMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
            >
              <ExportIcon />
              <span>Export</span>
            </button>
            {isExportMenuOpen ? (
              <div className="export-menu-popover" role="menu">
                <button
                  type="button"
                  className="export-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportJson();
                  }}
                >
                  JSON
                </button>
                <button
                  type="button"
                  className="export-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportMarkdown();
                  }}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  className="export-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportActivity();
                  }}
                >
                  Activity
                </button>
              </div>
            ) : null}
          </div>
          <div className="export-menu" ref={editorMenuRef}>
            <button
              type="button"
              className="btn-session-activity-toggle btn-export-toggle"
              onClick={() => setIsEditorMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isEditorMenuOpen}
            >
              <EditorIcon />
              <span>Editor</span>
            </button>
            {isEditorMenuOpen ? (
              <div className="export-menu-popover editor-menu-popover" role="menu">
                <label className="editor-menu-label" htmlFor="editor-selection">
                  Open file links with
                </label>
                <select
                  id="editor-selection"
                  className="editor-menu-select"
                  value={editorSelection}
                  onChange={(event) => onEditorSelectionChange(event.target.value as EditorOptionId)}
                >
                  {EDITOR_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {editorSelection === 'jetbrains' ? (
                  <>
                    <label className="editor-menu-label" htmlFor="jetbrains-product-selection">
                      JetBrains product
                    </label>
                    <select
                      id="jetbrains-product-selection"
                      className="editor-menu-select"
                      value={jetbrainsProduct}
                      onChange={(event) => onJetBrainsProductChange(event.target.value as JetBrainsProductId)}
                    >
                      {JETBRAINS_PRODUCT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label className="editor-menu-label" htmlFor="jetbrains-project-name">
                      JetBrains project name
                    </label>
                    <input
                      id="jetbrains-project-name"
                      type="text"
                      className="editor-menu-input"
                      value={jetbrainsProjectName}
                      onChange={(event) => onJetBrainsProjectNameChange(event.target.value)}
                      placeholder="Optional"
                    />
                    <p className="editor-menu-hint">
                      Set this to the project name already open in your JetBrains IDE. Leave it empty to open by
                      path only.
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <ConversationActions
            conversation={conversation}
            onShowToast={onShowToast}
            onConversationDeleted={onConversationDeleted}
          />
        </div>
      </div>
      <div className="detail-meta">
        {!isHeaderCollapsed ? (
          <div className="detail-meta-primary">
            <span className={`agent-badge agent-${conversation.agentType}`}>
              <AgentIcon agent={conversation.agentType} />
            </span>
            <span className="detail-date">{new Date(conversation.timestamp).toLocaleString()}</span>
            {conversation.status === 'archived' ? <span className="status-badge">Archived</span> : null}
          </div>
        ) : null}
        {isHeaderCollapsed ? (
          <div className="detail-utility-strip detail-utility-strip-compact">
            <div className="prompt-navigation">
              <span className="detail-control-label">Search</span>
              <span className="prompt-navigation-status">
                {searchMatchCount === 0 ? '0 / 0' : `${searchMatchPosition} / ${searchMatchCount}`}
              </span>
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
                className="btn-session-activity-toggle btn-session-activity-icon"
                onClick={onToggleSessionActivity}
                aria-label={showSessionActivity ? 'Hide Activity' : 'Show Activity'}
                title={showSessionActivity ? 'Hide Activity' : 'Show Activity'}
              >
                <EyeIcon />
              </button>
            ) : null}
            {showSessionActivity && hasExpandableActivities ? (
              <button
                type="button"
                className="btn-session-activity-toggle btn-session-activity-icon"
                onClick={onToggleAllActivities}
                aria-label={allAgentActivitiesExpanded ? 'Collapse All' : 'Expand All'}
                title={allAgentActivitiesExpanded ? 'Collapse All' : 'Expand All'}
              >
                <LayersIcon />
              </button>
            ) : null}
          </div>
        ) : (
          <div className="detail-utility-strip">
            <input
              ref={searchInputRef}
              type="search"
              className="transcript-search-input"
              placeholder="Search this conversation"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              title="Shortcuts: / or Ctrl/Cmd+F to focus, Alt+Up/Down for matches"
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
                className={`btn-session-activity-toggle ${isHeaderCollapsed ? 'btn-session-activity-icon' : ''}`}
                onClick={onToggleSessionActivity}
                aria-label={showSessionActivity ? 'Hide Activity' : 'Show Activity'}
                title={showSessionActivity ? 'Hide Activity' : 'Show Activity'}
              >
                <EyeIcon />
                {!isHeaderCollapsed ? <span> {showSessionActivity ? 'Hide Activity' : 'Show Activity'}</span> : null}
              </button>
            ) : null}
            {showSessionActivity && hasExpandableActivities ? (
              <button
                type="button"
                className={`btn-session-activity-toggle ${isHeaderCollapsed ? 'btn-session-activity-icon' : ''}`}
                onClick={onToggleAllActivities}
                aria-label={allAgentActivitiesExpanded ? 'Collapse All' : 'Expand All'}
                title={allAgentActivitiesExpanded ? 'Collapse All' : 'Expand All'}
              >
                <LayersIcon />
                {!isHeaderCollapsed ? <span> {allAgentActivitiesExpanded ? 'Collapse All' : 'Expand All'}</span> : null}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
