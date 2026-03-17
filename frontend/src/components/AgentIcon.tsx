import React from 'react';
import type { AgentType } from '../types';

type AgentIconName = AgentType | 'all';

interface AgentIconProps {
  agent: AgentIconName;
  label?: string;
  className?: string;
}

const LABELS: Record<AgentIconName, string> = {
  all: 'All Agents',
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
};

const iconMap: Record<AgentIconName, React.ReactNode> = {
  all: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="7.5" cy="8" r="3" />
      <circle cx="16.5" cy="8" r="3" />
      <circle cx="12" cy="15.8" r="3" />
    </svg>
  ),
  claude: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.2l1.45 4.1 4.35-.75-.76 4.34 4.11 1.46-4.11 1.45.76 4.35-4.35-.76L12 21l-1.45-4.11-4.35.76.76-4.35L2.85 12l4.11-1.46-.76-4.34 4.35.75L12 3.2z" />
      <circle cx="12" cy="12" r="2.15" fill="currentColor" />
    </svg>
  ),
  codex: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 5.2L4.4 8v8l3.8 2.8 3.8-2.8V8L8.2 5.2z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M15.8 5.2L12 8v8l3.8 2.8 3.8-2.8V8l-3.8-2.8z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M9.8 12h4.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8l1.7 5.7L19.2 10.2l-5.5 1.6L12 21.2l-1.7-9.4-5.5-1.6 5.5-1.7L12 2.8z" />
      <path d="M17.8 3.6l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3z" />
    </svg>
  ),
};

export const AgentIcon: React.FC<AgentIconProps> = ({ agent, label, className }) => {
  const resolvedLabel = label ?? LABELS[agent];

  return (
    <span className={`agent-icon agent-icon-${agent}${className ? ` ${className}` : ''}`}>
      <span className="agent-icon-mark">{iconMap[agent]}</span>
      <span className="agent-icon-label">{resolvedLabel}</span>
    </span>
  );
};
