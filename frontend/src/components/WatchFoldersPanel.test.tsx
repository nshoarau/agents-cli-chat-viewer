import React from 'react';
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

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WatchFoldersPanel isOpen onClose={vi.fn()} onShowToast={vi.fn()} shouldHighlightRecommendations />
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
    expect(screen.getByText('/home/test/.codex/sessions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/config/watch-folders', {
        folderPath: '/home/test/.codex/sessions',
        label: 'Codex Sessions',
      })
    );
  });
});
