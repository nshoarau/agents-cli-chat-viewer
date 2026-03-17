import React, { useMemo, useState } from 'react';
import { List } from 'react-window';
import type { RowComponentProps } from 'react-window';
import type { ConversationSummary } from '../types';
import { AgentIcon } from './AgentIcon';

interface ConversationListProps {
  conversations: ConversationSummary[];
  onSelect: (id: string) => void;
  selectedId?: string;
}

type HeaderItem =
  | { kind: 'agent'; key: string; label: string; count: number }
  | { kind: 'project'; key: string; label: string; count: number; collapsed: boolean };

type ListItem = HeaderItem | ConversationSummary;

const getLatestTimestamp = (conversations: ConversationSummary[]): number =>
  Math.max(...conversations.map((conversation) => new Date(conversation.timestamp).getTime()));

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  onSelect,
  selectedId,
}) => {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const listItems = useMemo(() => {
    const agentGroups = new Map<string, ConversationSummary[]>();
    conversations.forEach((conversation) => {
      const existing = agentGroups.get(conversation.agentType) ?? [];
      existing.push(conversation);
      agentGroups.set(conversation.agentType, existing);
    });

    const items: ListItem[] = [];
    const shouldShowAgentHeaders = agentGroups.size > 1;

    Array.from(agentGroups.entries())
      .sort(([, left], [, right]) => getLatestTimestamp(right) - getLatestTimestamp(left))
      .forEach(([agentType, agentConversations]) => {
        if (shouldShowAgentHeaders) {
          items.push({
            kind: 'agent',
            key: `agent:${agentType}`,
            label: agentType,
            count: agentConversations.length,
          });
        }

        const projectGroups = new Map<string, ConversationSummary[]>();
        agentConversations.forEach((conversation) => {
          const projectKey = conversation.projectPath || conversation.project || 'General';
          const existing = projectGroups.get(projectKey) ?? [];
          existing.push(conversation);
          projectGroups.set(projectKey, existing);
        });

        Array.from(projectGroups.entries())
          .sort(([, left], [, right]) => getLatestTimestamp(right) - getLatestTimestamp(left))
          .forEach(([projectKey, projectConversations]) => {
            const headerKey = `project:${agentType}:${projectKey}`;
            const collapsed = collapsedProjects[headerKey] ?? false;
            items.push({
              kind: 'project',
              key: headerKey,
              label: projectConversations[0]?.project || 'General',
              count: projectConversations.length,
              collapsed,
            });

            if (collapsed) {
              return;
            }

            const sortedConversations = [...projectConversations].sort(
              (left, right) =>
                new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
            );
            items.push(...sortedConversations);
          });
      });

    return items;
  }, [collapsedProjects, conversations]);

  const toggleProject = (key: string) => {
    setCollapsedProjects((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const Row = ({ index, style }: RowComponentProps<Record<string, never>>) => {
    const item = listItems[index];

    if (!('id' in item)) {
      const isProject = item.kind === 'project';
      return (
        <button
          type="button"
          style={style}
          className={`${isProject ? 'project-header' : 'agent-group-header'} ${
            isProject ? 'project-header-button' : ''
          }`}
          onClick={isProject ? () => toggleProject(item.key) : undefined}
        >
          <span className="group-header-main">
            {isProject ? (
              <span className={`collapse-indicator ${item.collapsed ? 'collapsed' : ''}`}>▾</span>
            ) : null}
            <span className="project-name">
              {isProject ? item.label : <AgentIcon agent={item.label as ConversationSummary['agentType']} />}
            </span>
          </span>
          <span className="group-count">
            {item.count} {item.count === 1 ? 'session' : 'sessions'}
          </span>
        </button>
      );
    }

    return (
      <div
        style={style}
        className={`conversation-item ${selectedId === item.id ? 'active' : ''}`}
        onClick={() => onSelect(item.id)}
      >
        <div className="conv-header">
          <span className={`agent-badge agent-${item.agentType}`}>
            <AgentIcon agent={item.agentType} />
          </span>
          <span className="conv-date">{new Date(item.timestamp).toLocaleDateString()}</span>
        </div>
        <div className="conv-title">{item.title}</div>
      </div>
    );
  };

  if (conversations.length === 0) {
    return <div className="empty-list">No conversations found. Add some logs to get started!</div>;
  }

  return (
    <List<Record<string, never>>
      rowCount={listItems.length}
      rowHeight={(index) => {
        const item = listItems[index];
        if (!('id' in item)) {
          return item.kind === 'agent' ? 36 : 40;
        }

        return 85;
      }}
      rowComponent={Row}
      rowProps={{}}
      style={{ height: 'calc(100vh - 60px)', width: '100%' }}
    />
  );
};
