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
        onOpenFile={vi.fn()}
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
        onOpenFile={vi.fn()}
      />
    );

    expect(screen.getByText('Search term')).toHaveClass('message-search-highlight');
  });

  it('opens file references mentioned directly in the message content', () => {
    const onOpenFile = vi.fn();

    render(
      <ConversationMessageBubble
        message={makeMessage({
          content: 'Please inspect [the app file](src/app.ts) and `src/utils.ts`.',
        })}
        messageIndex={0}
        onShowToast={vi.fn()}
        isPromptTarget={false}
        isActiveSearchTarget={false}
        showSessionActivity={false}
        isActivityExpanded={false}
        onToggleActivity={vi.fn()}
        onOpenFile={onOpenFile}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'the app file' }));
    expect(onOpenFile).toHaveBeenCalledWith('src/app.ts');

    fireEvent.click(screen.getByRole('button', { name: 'src/utils.ts' }));
    expect(onOpenFile).toHaveBeenCalledWith('src/utils.ts');
  });

  it('does not link git refs, folders, or bare hosts from message content', () => {
    render(
      <ConversationMessageBubble
        message={makeMessage({
          content: 'Ignore origin/main, src/components, and 127.0.0.1/api while opening src/app.ts.',
        })}
        messageIndex={0}
        onShowToast={vi.fn()}
        isPromptTarget={false}
        isActiveSearchTarget={false}
        showSessionActivity={false}
        isActivityExpanded={false}
        onToggleActivity={vi.fn()}
        onOpenFile={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'src/app.ts' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'origin/main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'src/components' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '127.0.0.1/api' })).not.toBeInTheDocument();
  });
});
