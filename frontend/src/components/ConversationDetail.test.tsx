import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
        truncated: false,
        previewStatus: 'ready',
        rawUrl: '/api/conversations/conv-preview/files/raw?path=src%2Fapp.ts',
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

    expect(await screen.findByRole('link', { name: 'Open Raw' })).toHaveAttribute(
      'href',
      '/api/conversations/conv-preview/files/raw?path=src%2Fapp.ts'
    );
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

  it('shows structured preview status messages for binary files', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/image.bin',
        content: '',
        truncated: false,
        previewStatus: 'binary',
        previewMessage: 'Binary files cannot be previewed as text. Open the raw file instead.',
        rawUrl: '/api/conversations/conv-preview/files/raw?path=image.bin',
      },
    } as never);

    renderConversationDetail(
      makeConversation({
        sessionActivity: {
          commands: ['cat image.bin'],
          filesTouched: ['image.bin'],
          toolCalls: [
            {
              id: 'tool-binary',
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: 'image.bin',
            },
          ],
        },
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /show activity/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'image.bin' })[0]);

    expect(await screen.findByText('Binary files cannot be previewed as text. Open the raw file instead.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Raw' })).toHaveAttribute(
      'href',
      '/api/conversations/conv-preview/files/raw?path=image.bin'
    );
    expect(screen.queryByText(/console\.log/)).not.toBeInTheDocument();
  });

  it('shows a raw fallback for oversized previews', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/large.txt',
        content: '',
        truncated: false,
        previewStatus: 'too_large',
        previewMessage: 'File is too large to preview inline. Open the raw file instead.',
        rawUrl: '/api/conversations/conv-preview/files/raw?path=large.txt',
      },
    } as never);

    renderConversationDetail(
      makeConversation({
        sessionActivity: {
          commands: ['cat large.txt'],
          filesTouched: ['large.txt'],
          toolCalls: [
            {
              id: 'tool-large',
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: 'large.txt',
            },
          ],
        },
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /show activity/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'large.txt' })[0]);

    expect(await screen.findByText('File is too large to preview inline. Open the raw file instead.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Raw' })).toHaveAttribute(
      'href',
      '/api/conversations/conv-preview/files/raw?path=large.txt'
    );
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

  it('shows a files panel grouped by folder with source badges', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/src/app.ts',
        content: 'console.log("from files panel");',
        truncated: false,
      },
    } as never);

    renderConversationDetail(
      makeConversation({
        messages: [
          {
            sender: 'user',
            content: 'Inspect [app.ts](src/app.ts) and src/utils/date.ts.',
            timestamp: '2026-03-17T12:00:00.000Z',
          },
          {
            sender: 'agent',
            content: 'Updated src/app.ts.',
            timestamp: '2026-03-17T12:00:02.000Z',
          },
        ],
        sessionActivity: {
          commands: ['cat src/app.ts'],
          filesTouched: ['src/app.ts', 'README.md'],
          toolCalls: [
            {
              id: 'tool-1',
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: 'src/app.ts',
            },
          ],
        },
      })
    );

    const filesRegion = screen.getByRole('region', { name: 'Files' });
    expect(within(filesRegion).queryByText('src')).not.toBeInTheDocument();

    fireEvent.click(within(filesRegion).getByRole('button', { name: 'Show Files (3)' }));

    expect(within(filesRegion).getByText('src')).toBeInTheDocument();
    expect(within(filesRegion).getByText('(root)')).toBeInTheDocument();
    expect(within(filesRegion).getByText('Both')).toBeInTheDocument();
    expect(within(filesRegion).getByText('Prompt')).toBeInTheDocument();
    expect(within(filesRegion).getByText('Activity')).toBeInTheDocument();

    fireEvent.click(within(filesRegion).getByRole('button', { name: 'src/app.ts' }));

    expect(await screen.findByRole('dialog', { name: 'File Preview' })).toBeInTheDocument();
    expect(await screen.findByText('console.log("from files panel");')).toBeInTheDocument();
  });

  it('uses the same canonical preview path from the files panel as the working message links', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/src/app.ts',
        content: 'console.log("canonical");',
        truncated: false,
        previewStatus: 'ready',
      },
    } as never);

    renderConversationDetail(
      makeConversation({
        messages: [
          {
            sender: 'user',
            content: 'Inspect [app.ts](src/app.ts).',
            timestamp: '2026-03-17T12:00:00.000Z',
          },
          {
            sender: 'agent',
            content: 'Updated /tmp/viewer/src/app.ts.',
            timestamp: '2026-03-17T12:00:02.000Z',
          },
        ],
        sessionActivity: {
          commands: ['cat /tmp/viewer/src/app.ts'],
          filesTouched: ['/tmp/viewer/src/app.ts'],
          toolCalls: [
            {
              id: 'tool-abs',
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: '/tmp/viewer/src/app.ts',
            },
          ],
        },
      })
    );

    const filesRegion = screen.getByRole('region', { name: 'Files' });
    fireEvent.click(within(filesRegion).getByRole('button', { name: 'Show Files (1)' }));
    fireEvent.click(within(filesRegion).getByRole('button', { name: 'src/app.ts' }));

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-preview/files/content', {
        params: { path: '/tmp/viewer/src/app.ts' },
      })
    );
  });

  it('prefers the working absolute message path over a relative activity path in the files panel', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/frontend/src/components/conversationFilesPanelUtils.ts',
        content: 'export const ok = true;',
        truncated: false,
        previewStatus: 'ready',
      },
    } as never);

    renderConversationDetail(
      makeConversation({
        projectPath: '/tmp/viewer/frontend',
        messages: [
          {
            sender: 'user',
            content: 'Inspect /tmp/viewer/frontend/src/components/conversationFilesPanelUtils.ts.',
            timestamp: '2026-03-17T12:00:00.000Z',
          },
        ],
        sessionActivity: {
          commands: ['cat src/components/conversationFilesPanelUtils.ts'],
          filesTouched: ['src/components/conversationFilesPanelUtils.ts'],
          toolCalls: [
            {
              id: 'tool-rel',
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: 'src/components/conversationFilesPanelUtils.ts',
            },
          ],
        },
      })
    );

    const filesRegion = screen.getByRole('region', { name: 'Files' });
    fireEvent.click(within(filesRegion).getByRole('button', { name: 'Show Files (1)' }));
    fireEvent.click(within(filesRegion).getByRole('button', { name: 'src/components/conversationFilesPanelUtils.ts' }));

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-preview/files/content', {
        params: { path: '/tmp/viewer/frontend/src/components/conversationFilesPanelUtils.ts' },
      })
    );
  });

  it('keeps the files panel collapsed by default and toggles it open', () => {
    renderConversationDetail(makeConversation());

    const filesRegion = screen.getByRole('region', { name: 'Files' });
    const toggleButton = within(filesRegion).getByRole('button', { name: 'Show Files (1)' });

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(within(filesRegion).queryByText('src')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(within(filesRegion).getByText('src')).toBeInTheDocument();
    expect(within(filesRegion).getByRole('button', { name: 'Hide Files' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the full files list in a modal and previews a file from there', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        filePath: '/tmp/viewer/src/app.ts',
        content: 'console.log("from files modal");',
        truncated: false,
      },
    } as never);

    renderConversationDetail(makeConversation());

    const filesRegion = screen.getByRole('region', { name: 'Files' });
    fireEvent.click(within(filesRegion).getByRole('button', { name: 'Open Full List' }));

    const filesModal = await screen.findByRole('dialog', { name: 'All Files' });
    fireEvent.click(within(filesModal).getByRole('button', { name: 'src/app.ts' }));

    expect(await screen.findByRole('dialog', { name: 'File Preview' })).toBeInTheDocument();
    expect(await screen.findByText('console.log("from files modal");')).toBeInTheDocument();
  });

  it('hides the inline files panel in transcript mode and opens the files modal from the header', async () => {
    renderConversationDetail(makeConversation());

    expect(screen.getByRole('region', { name: 'Files' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /focus transcript/i }));

    expect(screen.queryByRole('region', { name: 'Files' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Files' }));

    expect(await screen.findByRole('dialog', { name: 'All Files' })).toBeInTheDocument();
  });
});
