import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConversationActions } from './ConversationActions';
import { apiClient } from '../services/apiClient';
import type { Conversation } from '../types';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-1',
  agentType: 'codex',
  timestamp: '2026-03-17T12:00:00.000Z',
  title: 'Test conversation',
  status: 'active',
  filePath: '/tmp/test.json',
  messages: [],
  ...overrides,
});

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('ConversationActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms and archives a conversation', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({} as never);
    const onShowToast = vi.fn();

    renderWithQueryClient(
      <ConversationActions
        conversation={makeConversation()}
        onShowToast={onShowToast}
        onConversationDeleted={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Archive conversation'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith('/conversations/conv-1/status', { status: 'archived' })
    );
    expect(onShowToast).toHaveBeenCalledWith('Conversation archived.');
  });

  it('confirms and deletes a conversation', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({} as never);
    const onConversationDeleted = vi.fn();

    renderWithQueryClient(
      <ConversationActions
        conversation={makeConversation()}
        onShowToast={vi.fn()}
        onConversationDeleted={onConversationDeleted}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/conversations/conv-1'));
    expect(onConversationDeleted).toHaveBeenCalledWith('conv-1');
  });
});
