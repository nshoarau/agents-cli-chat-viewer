import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationMessageBubble } from './ConversationMessageBubble';
import type { Message } from '../types';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  sender: 'agent',
  content: 'Search term appears here.',
  timestamp: '2026-03-17T12:00:00.000Z',
  ...overrides,
});

describe('ConversationMessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it('copies the main message content and shows copied state', async () => {
    const onShowToast = vi.fn();

    render(
      <ConversationMessageBubble
        message={makeMessage()}
        messageIndex={0}
        onShowToast={onShowToast}
        isPromptTarget={false}
        isActiveSearchTarget={false}
        showSessionActivity={false}
        isActivityExpanded={false}
        onToggleActivity={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy message text' }));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Search term appears here.')
    );
    expect(onShowToast).toHaveBeenCalledWith('Message copied.');
    expect(screen.getByRole('button', { name: 'Message copied' })).toBeInTheDocument();
  });

  it('highlights matching search text in the rendered markdown', () => {
    render(
      <ConversationMessageBubble
        message={makeMessage()}
        messageIndex={0}
        searchHighlightQuery="search term"
        onShowToast={vi.fn()}
        isPromptTarget={false}
        isActiveSearchTarget={false}
        showSessionActivity={false}
        isActivityExpanded={false}
        onToggleActivity={vi.fn()}
      />
    );

    expect(screen.getByText('Search term')).toHaveClass('message-search-highlight');
  });
});
