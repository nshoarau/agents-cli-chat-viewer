import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WatchFoldersPanel } from './WatchFoldersPanel';
import { apiClient } from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const renderPanel = (isOpen = true) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WatchFoldersPanel
        isOpen={isOpen}
        onClose={vi.fn()}
        onShowToast={vi.fn()}
        shouldHighlightRecommendations
      />
    </QueryClientProvider>
  );
};

describe('WatchFoldersPanel onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders suggested sources and enables one-click activation', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        folders: [],
        recommendations: [
          {
            label: 'Codex Sessions',
            sourcePath: '/home/test/.codex/sessions',
            targetName: 'codex-sessions',
            kind: 'default',
          },
        ],
      },
    } as never);
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} } as never);

    renderPanel();

    expect(await screen.findByText('Suggested Sources')).toBeInTheDocument();
    expect(screen.queryByText('/home/test/.codex/sessions')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Suggested Sources/i }));

    expect(screen.getByText('/home/test/.codex/sessions')).toBeInTheDocument();
    expect(screen.getByText(/one-click sources found automatically/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/config/watch-folders', {
        folderPath: '/home/test/.codex/sessions',
        label: 'Codex Sessions',
      })
    );
  });

  it('allows suggested sources to be collapsed', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        folders: [],
        recommendations: [
          {
            label: 'Codex Sessions',
            sourcePath: '/home/test/.codex/sessions',
            targetName: 'codex-sessions',
            kind: 'default',
          },
        ],
      },
    } as never);

    renderPanel();

    expect(await screen.findByText('Suggested Sources')).toBeInTheDocument();
    expect(screen.queryByText('/home/test/.codex/sessions')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Suggested Sources/i }));

    expect(screen.getByText('/home/test/.codex/sessions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Suggested Sources/i }));

    expect(screen.queryByText('/home/test/.codex/sessions')).not.toBeInTheDocument();
  });

  it('keeps custom path collapsed on first render', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        folders: [],
        recommendations: [],
      },
    } as never);

    renderPanel();

    expect(await screen.findByText('Custom Path')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Absolute path')).not.toBeInTheDocument();
  });

  it('resets both collapsible sections when the panel opens again', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        folders: [],
        recommendations: [
          {
            label: 'Claude Sessions',
            sourcePath: '/home/test/.claude/sessions',
            targetName: 'claude-sessions',
            kind: 'default',
          },
        ],
      },
    } as never);

    const view = renderPanel(false);

    view.rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })}>
        <WatchFoldersPanel isOpen onClose={vi.fn()} onShowToast={vi.fn()} shouldHighlightRecommendations />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Suggested Sources')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Suggested Sources/i }));
    fireEvent.click(screen.getByRole('button', { name: /Custom Path/i }));

    expect(screen.getByText('/home/test/.claude/sessions')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Absolute path')).toBeInTheDocument();

    view.rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })}>
        <WatchFoldersPanel isOpen={false} onClose={vi.fn()} onShowToast={vi.fn()} shouldHighlightRecommendations />
      </QueryClientProvider>
    );

    view.rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })}>
        <WatchFoldersPanel isOpen onClose={vi.fn()} onShowToast={vi.fn()} shouldHighlightRecommendations />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Suggested Sources')).toBeInTheDocument();
    expect(screen.queryByText('/home/test/.claude/sessions')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Absolute path')).not.toBeInTheDocument();
  });
});
