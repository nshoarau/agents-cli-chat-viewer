import React, { useState } from 'react';
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
  copilot: 'Copilot',
  cursor: 'Cursor',
  opencode: 'OpenCode',
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
  copilot: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 8.1a4.3 4.3 0 018.6 0v.6a3.6 3.6 0 012.5 3.4V15a3.8 3.8 0 01-3.8 3.8H9.4A3.8 3.8 0 015.6 15v-2.9a3.6 3.6 0 012.5-3.4v-.6z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9.5" cy="13" r="1.1" />
      <circle cx="14.5" cy="13" r="1.1" />
    </svg>
  ),
  cursor: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6h7l5 5v7h-7l-5-5V6z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M9 9h4l2 2v4h-4l-2-2V9z" />
    </svg>
  ),
  opencode: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 7.1L4.4 12l3.8 4.9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.8 7.1l3.8 4.9-3.8 4.9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2 5.2l-2.4 13.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
};

const faviconUrls: Partial<Record<AgentType, string>> = {
  claude: '/agent-icons/claude.ico',
  gemini: '/agent-icons/gemini.svg',
  copilot: '/agent-icons/copilot.svg',
  cursor: '/agent-icons/cursor.ico',
  opencode: '/agent-icons/opencode.ico',
};

interface AgentMarkProps {
  agent: AgentIconName;
}

const AgentMark: React.FC<AgentMarkProps> = ({ agent }) => {
  const [didFail, setDidFail] = useState(false);
  const faviconUrl = agent === 'all' ? undefined : faviconUrls[agent];

  if (!faviconUrl || didFail) {
    return <>{iconMap[agent]}</>;
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      aria-hidden="true"
      className="agent-icon-image"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setDidFail(true)}
    />
  );
};

export const AgentIcon: React.FC<AgentIconProps> = ({ agent, label, className }) => {
  const resolvedLabel = label ?? LABELS[agent];

  return (
    <span className={`agent-icon agent-icon-${agent}${className ? ` ${className}` : ''}`}>
      <span className="agent-icon-mark">
        <AgentMark agent={agent} />
      </span>
      <span className="agent-icon-label">{resolvedLabel}</span>
    </span>
  );
};
