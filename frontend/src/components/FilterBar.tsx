import React from 'react';
import { useConversationStore } from '../store/useConversationStore';
import { AgentIcon } from './AgentIcon';
import type { AgentType } from '../types';

interface FilterBarProps {
  availableAgents: AgentType[];
}

export const FilterBar: React.FC<FilterBarProps> = ({ availableAgents }) => {
  const { showArchived, setShowArchived, selectedAgent, setSelectedAgent } = useConversationStore();

  return (
    <div className="sidebar-filters">
      <div className="sidebar-filter-card">
        <div className="sidebar-filter-title">Load Conversations</div>
        <div className="agent-filter-grid">
          {availableAgents.length > 1 ? (
            <button
              className={`agent-filter-btn ${selectedAgent === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedAgent('all')}
            >
              <AgentIcon agent="all" />
            </button>
          ) : null}
          {availableAgents.map((agent) => (
            <button
              key={agent}
              className={`agent-filter-btn ${selectedAgent === agent ? 'active' : ''}`}
              onClick={() => setSelectedAgent(agent)}
            >
              <AgentIcon agent={agent} />
            </button>
          ))}
        </div>
        {availableAgents.length === 0 ? (
          <div className="sidebar-filter-hint">Connect a watched folder to load conversations.</div>
        ) : selectedAgent === 'none' ? (
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
