import React from 'react';
import { useConversationStore } from '../store/useConversationStore';
import { AgentIcon } from './AgentIcon';

export const FilterBar: React.FC = () => {
  const { showArchived, setShowArchived, selectedAgent, setSelectedAgent } = useConversationStore();

  return (
    <div className="sidebar-filters">
      <div className="sidebar-filter-card">
        <div className="sidebar-filter-title">Load Conversations</div>
        <div className="agent-filter-grid">
          <button
            className={`agent-filter-btn ${selectedAgent === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedAgent('all')}
          >
            <AgentIcon agent="all" />
          </button>
          <button
            className={`agent-filter-btn ${selectedAgent === 'claude' ? 'active' : ''}`}
            onClick={() => setSelectedAgent('claude')}
          >
            <AgentIcon agent="claude" />
          </button>
          <button
            className={`agent-filter-btn ${selectedAgent === 'codex' ? 'active' : ''}`}
            onClick={() => setSelectedAgent('codex')}
          >
            <AgentIcon agent="codex" />
          </button>
          <button
            className={`agent-filter-btn ${selectedAgent === 'gemini' ? 'active' : ''}`}
            onClick={() => setSelectedAgent('gemini')}
          >
            <AgentIcon agent="gemini" />
          </button>
        </div>
        {selectedAgent === 'none' ? (
          <div className="sidebar-filter-hint">Select an agent to load conversations.</div>
        ) : null}
      </div>

      <div className="sidebar-filter-card">
        <label>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show Archived
        </label>
      </div>
    </div>
  );
};
