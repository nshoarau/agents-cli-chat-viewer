import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { apiClient } from '../services/apiClient';
import { useConversationStore } from '../store/useConversationStore';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('../hooks/useLogUpdates', () => ({
  useLogUpdates: vi.fn(),
}));

vi.mock('react-window', async () => {
  interface MockListProps {
    rowComponent: React.ComponentType<{
      index: number;
      style: React.CSSProperties;
      ariaAttributes: Record<string, string | number>;
    }>;
    rowCount: number;
    rowProps: Record<string, unknown>;
  }

  return {
    List: ({ rowComponent: RowComponent, rowCount, rowProps }: MockListProps) => (
      <div>
        {Array.from({ length: rowCount }, (_, index) => (
          <RowComponent
            key={index}
            index={index}
            style={{}}
            ariaAttributes={{ role: 'listitem', 'aria-posinset': index + 1 }}
            {...rowProps}
          />
        ))}
      </div>
    ),
    useDynamicRowHeight: () => 240,
  };
});

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
};

describe('Dashboard startup launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConversationStore.setState({
      searchQuery: '',
      showArchived: false,
      selectedAgent: 'none',
    });
  });

  it('shows a larger agent chooser when watch folders already exist', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        folders: [
          {
            id: 'codex-folder',
            label: 'Codex Sessions',
            sourcePath: '/home/test/.codex/sessions',
            targetName: 'codex-sessions',
            kind: 'default',
          },
          {
            id: 'claude-folder',
            label: 'Claude Projects',
            sourcePath: '/home/test/.claude/projects',
            targetName: 'claude-projects',
            kind: 'default',
          },
        ],
        recommendations: [],
      },
    } as never);

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Choose an agent source' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load All Agents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load Claude' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load Codex' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load Gemini' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load Codex' }));

    expect(useConversationStore.getState().selectedAgent).toBe('codex');
  });

  it('limits filter buttons to detected agents', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        folders: [
          {
            id: 'codex-folder',
            label: 'Codex Sessions',
            sourcePath: '/home/test/.codex/sessions',
            targetName: 'codex-sessions',
            kind: 'default',
          },
          {
            id: 'claude-folder',
            label: 'Claude Sessions',
            sourcePath: '/home/test/.claude/sessions',
            targetName: 'claude-sessions',
            kind: 'default',
          },
        ],
        recommendations: [],
      },
    } as never);

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'All Agents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claude' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Codex' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cursor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copilot' })).not.toBeInTheDocument();
  });

  it('shows a recent activity dashboard when conversations are loaded but none is selected', async () => {
    useConversationStore.setState({
      searchQuery: '',
      showArchived: false,
      selectedAgent: 'codex',
    });

    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/config/watch-folders') {
        return {
          data: {
            folders: [
              {
                id: 'codex-folder',
                label: 'Codex Sessions',
                sourcePath: '/home/test/.codex/sessions',
                targetName: 'codex-sessions',
                kind: 'default',
              },
            ],
            recommendations: [],
          },
        } as never;
      }

      if (url === '/conversations') {
        return {
          data: {
            items: [
              {
                id: 'conv-2',
                agentType: 'codex',
                timestamp: '2026-03-18T09:30:00.000Z',
                title: 'Refine dashboard empty state',
                status: 'active',
                filePath: '/tmp/conv-2.jsonl',
                project: 'viewer',
                projectPath: '/tmp/viewer',
                relativePath: 'conv-2.jsonl',
                messageCount: 18,
              },
              {
                id: 'conv-1',
                agentType: 'codex',
                timestamp: '2026-03-17T08:00:00.000Z',
                title: 'Fix sidebar loading',
                status: 'active',
                filePath: '/tmp/conv-1.jsonl',
                project: 'viewer',
                projectPath: '/tmp/viewer',
                relativePath: 'conv-1.jsonl',
                messageCount: 9,
              },
            ],
            total: 2,
            nextOffset: null,
          },
        } as never;
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Session traffic at a glance' })).toBeInTheDocument();
    expect(screen.getByText('Recent timeline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Latest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refine dashboard empty state/i })).toBeInTheDocument();
  });

  it('offers a reduced sidebar mode that keeps the session list visible', async () => {
    useConversationStore.setState({
      searchQuery: '',
      showArchived: false,
      selectedAgent: 'codex',
    });

    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/config/watch-folders') {
        return {
          data: {
            folders: [
              {
                id: 'codex-folder',
                label: 'Codex Sessions',
                sourcePath: '/home/test/.codex/sessions',
                targetName: 'codex-sessions',
                kind: 'default',
              },
            ],
            recommendations: [],
          },
        } as never;
      }

      if (url === '/conversations') {
        return {
          data: {
            items: [
              {
                id: 'conv-2',
                agentType: 'codex',
                timestamp: '2026-03-18T09:30:00.000Z',
                title: 'Refine dashboard empty state',
                status: 'active',
                filePath: '/tmp/conv-2.jsonl',
                project: 'viewer',
                projectPath: '/tmp/viewer',
                relativePath: 'conv-2.jsonl',
                messageCount: 18,
              },
            ],
            total: 1,
            nextOffset: null,
          },
        } as never;
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    renderDashboard();

    expect(await screen.findByRole('button', { name: 'Reduce sidebar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reduce sidebar' }));

    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Filters' })).toBeInTheDocument();
    expect(screen.getAllByText('Refine dashboard empty state')).toHaveLength(2);
  });
});
