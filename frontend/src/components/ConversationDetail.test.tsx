import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationDetail } from './ConversationDetail';
import { apiClient } from '../services/apiClient';
import type { Conversation } from '../types';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
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

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-preview',
  agentType: 'codex',
  timestamp: '2026-03-17T12:00:00.000Z',
  title: 'Preview Test',
  status: 'active',
  filePath: '/tmp/session.jsonl',
  project: 'viewer',
  projectPath: '/tmp/viewer',
  messages: [
    {
      sender: 'user',
      content: 'Please update the file.',
      timestamp: '2026-03-17T12:00:00.000Z',
    },
    {
      sender: 'agent',
      content: 'I updated it.',
      timestamp: '2026-03-17T12:00:01.000Z',
    },
  ],
  sessionActivity: {
    commands: ['cat src/app.ts'],
    filesTouched: ['src/app.ts'],
    toolCalls: [
      {
        id: 'tool-1',
        name: 'read_file',
        kind: 'read',
        timestamp: '2026-03-17T12:00:01.000Z',
        filePath: 'src/app.ts',
        command: 'cat src/app.ts',
      },
    ],
  },
  ...overrides,
});

const renderConversationDetail = (conversation: Conversation) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConversationDetail
        conversation={conversation}
        isLoading={false}
        onShowToast={vi.fn()}
        onConversationDeleted={vi.fn()}
        isSidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
        onSetSidebarCollapsed={vi.fn()}
      />
    </QueryClientProvider>
  );
};

describe('ConversationDetail file preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    delete import.meta.env.VITE_EDITOR_URI_TEMPLATE;
  });

  it('loads and renders a file preview from session activity', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/src/app.ts',
        content: 'console.log("preview");',
        truncated: true,
      },
    } as never);

    renderConversationDetail(makeConversation());

    fireEvent.click(screen.getByRole('button', { name: /show activity/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'src/app.ts' })[0]);

    expect(await screen.findByRole('dialog', { name: 'File Preview' })).toBeInTheDocument();

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-preview/files/content', {
        params: { path: 'src/app.ts' },
      })
    );

    expect(await screen.findByText('Preview truncated to keep the viewer responsive.')).toBeInTheDocument();
    expect(screen.getByText('console.log("preview");')).toBeInTheDocument();
  });

  it('shows API errors in the file preview modal', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new AxiosError('Request failed'), {
        response: {
          data: {
            error: 'File is not available for this conversation preview.',
          },
        },
      })
    );

    renderConversationDetail(makeConversation());

    fireEvent.click(screen.getByRole('button', { name: /show activity/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'src/app.ts' })[0]);

    expect(await screen.findByRole('dialog', { name: 'File Preview' })).toBeInTheDocument();
    expect(
      await screen.findByText('File is not available for this conversation preview.')
    ).toBeInTheDocument();
  });

  it('loads a file preview for a file referenced only in a prompt message', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/src/prompt.ts',
        content: 'export const fromPrompt = true;',
        truncated: false,
      },
    } as never);

    renderConversationDetail(
      makeConversation({
        messages: [
          {
            sender: 'user',
            content: 'Please inspect [prompt.ts](src/prompt.ts).',
            timestamp: '2026-03-17T12:00:00.000Z',
          },
          {
            sender: 'agent',
            content: 'Checking now.',
            timestamp: '2026-03-17T12:00:01.000Z',
          },
        ],
        sessionActivity: undefined,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'prompt.ts' }));

    expect(await screen.findByRole('dialog', { name: 'File Preview' })).toBeInTheDocument();

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-preview/files/content', {
        params: { path: 'src/prompt.ts' },
      })
    );

    expect(await screen.findByText('export const fromPrompt = true;')).toBeInTheDocument();
  });

  it('uses the configured editor URI template for the IDE link', async () => {
    import.meta.env.VITE_EDITOR_URI_TEMPLATE = 'cursor://file{{path}}';
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/src/app.ts',
        content: 'console.log("preview");',
        truncated: false,
      },
    } as never);

    renderConversationDetail(makeConversation());

    fireEvent.click(screen.getByRole('button', { name: /show activity/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'src/app.ts' })[0]);

    const openLink = await screen.findByRole('link', { name: 'Open in IDE' });
    expect(openLink).toHaveAttribute('href', 'cursor://file/tmp/viewer/src/app.ts');
  });

  it('updates the editor selection from the header menu', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/src/app.ts',
        content: 'console.log("preview");',
        truncated: false,
      },
    } as never);

    renderConversationDetail(makeConversation());

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
    fireEvent.change(screen.getByLabelText('Open file links with'), {
      target: { value: 'zed' },
    });

    fireEvent.click(screen.getByRole('button', { name: /show activity/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'src/app.ts' })[0]);

    const openLink = await screen.findByRole('link', { name: 'Open in IDE' });
    expect(openLink).toHaveAttribute('href', 'zed://file/tmp/viewer/src/app.ts');
  });

  it('uses the selected JetBrains product and project-relative path', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/CLAUDE.md',
        editorPath: '/tmp/viewer/CLAUDE.md',
        content: '# hi',
        truncated: false,
      },
    } as never);

    renderConversationDetail(
      makeConversation({
        projectPath: '/tmp/viewer',
        sessionActivity: {
          commands: ['cat CLAUDE.md'],
          filesTouched: ['CLAUDE.md'],
          toolCalls: [
            {
              id: 'tool-claude',
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: 'CLAUDE.md',
              command: 'cat CLAUDE.md',
            },
          ],
        },
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
    fireEvent.change(screen.getByLabelText('Open file links with'), { target: { value: 'jetbrains' } });
    fireEvent.change(screen.getByLabelText('JetBrains product'), { target: { value: 'php-storm' } });
    fireEvent.change(screen.getByLabelText('JetBrains project name'), { target: { value: 'UnlinkIt' } });

    fireEvent.click(screen.getByRole('button', { name: /show activity/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'CLAUDE.md' })[0]);

    const openLink = await screen.findByRole('link', { name: 'Open in IDE' });
    expect(openLink).toHaveAttribute(
      'href',
      'jetbrains://php-storm/navigate/reference?project=UnlinkIt&path=CLAUDE.md'
    );
  });
});
