import { expect, test, type Page } from '@playwright/test';
import type { Conversation, ConversationSummary } from '../src/types';

type MockConversation = ConversationSummary & {
  messages: Conversation['messages'];
};

const conversationFixtures: MockConversation[] = [
  {
    id: 'conv-gemini',
    agentType: 'gemini',
    timestamp: '2026-03-17T12:00:00.000Z',
    title: 'Gemini release recap',
    status: 'active',
    filePath: '/logs/workspaces/portal/gemini/session-3.jsonl',
    project: 'Portal',
    projectPath: '/workspaces/portal',
    relativePath: 'workspaces/portal/gemini/session-3.jsonl',
    messageCount: 2,
    messages: [
      {
        sender: 'user',
        content: 'Summarize the latest release notes.',
        timestamp: '2026-03-17T11:59:00.000Z',
      },
      {
        sender: 'agent',
        content: 'The release focused on search quality and transcript polish.',
        timestamp: '2026-03-17T12:00:00.000Z',
      },
    ],
  },
  {
    id: 'conv-claude',
    agentType: 'claude',
    timestamp: '2026-03-17T11:00:00.000Z',
    title: 'Claude bug fix plan',
    status: 'active',
    filePath: '/logs/clients/console/claude/run-1.jsonl',
    project: 'Console',
    projectPath: '/clients/console',
    relativePath: 'clients/console/claude/run-1.jsonl',
    messageCount: 4,
    messages: [
      {
        sender: 'user',
        content: 'Investigate the login timeout issue.',
        timestamp: '2026-03-17T10:58:00.000Z',
      },
      {
        sender: 'agent',
        content: 'I found the problem in the auth middleware.',
        timestamp: '2026-03-17T10:59:00.000Z',
      },
      {
        sender: 'user',
        content: 'Search for retry logic and document the next steps.',
        timestamp: '2026-03-17T11:00:00.000Z',
      },
      {
        sender: 'agent',
        content: 'Retry logic lives in src/auth/retry.ts and needs cleaner backoff defaults.',
        timestamp: '2026-03-17T11:01:00.000Z',
      },
    ],
  },
  {
    id: 'conv-codex',
    agentType: 'codex',
    timestamp: '2026-03-17T10:00:00.000Z',
    title: 'Codex refactor session',
    status: 'active',
    filePath: '/logs/services/api/codex/run-2.jsonl',
    project: 'API',
    projectPath: '/services/api',
    relativePath: 'services/api/codex/run-2.jsonl',
    messageCount: 2,
    messages: [
      {
        sender: 'user',
        content: 'Refactor the dashboard delete flow.',
        timestamp: '2026-03-17T09:58:00.000Z',
      },
      {
        sender: 'agent',
        content: 'The delete flow now selects the next conversation automatically.',
        timestamp: '2026-03-17T10:00:00.000Z',
      },
    ],
  },
];

const cloneConversations = (): MockConversation[] =>
  JSON.parse(JSON.stringify(conversationFixtures)) as MockConversation[];

const toSummary = (conversation: MockConversation): ConversationSummary => {
  const { messages, ...summary } = conversation;
  void messages;
  return summary;
};

const toDetail = (conversation: MockConversation): Conversation => ({
  id: conversation.id,
  agentType: conversation.agentType,
  timestamp: conversation.timestamp,
  title: conversation.title,
  status: conversation.status,
  filePath: conversation.filePath,
  project: conversation.project,
  projectPath: conversation.projectPath,
  messages: conversation.messages,
});

const installMocks = async (page: Page) => {
  const state = {
    conversations: cloneConversations(),
  };

  await page.addInitScript(() => {
    class MockEventSource {
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string) {
        void url;
      }

      close() {}

      addEventListener() {}

      removeEventListener() {}
    }

    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: MockEventSource,
    });

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { __copiedText?: string }).__copiedText = text;
        },
      },
    });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api', '');

    if (request.method() === 'GET' && path === '/conversations') {
      const agentType = url.searchParams.get('agentType');
      const items = state.conversations
        .filter((conversation) => (agentType ? conversation.agentType === agentType : true))
        .map(toSummary);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items,
          total: items.length,
          nextOffset: null,
        }),
      });
      return;
    }

    if (request.method() === 'GET' && path.startsWith('/conversations/')) {
      const [, , conversationId] = path.split('/');
      const conversation = state.conversations.find((item) => item.id === conversationId);

      if (!conversation) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Conversation not found' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(toDetail(conversation)),
      });
      return;
    }

    if (request.method() === 'PATCH' && path.endsWith('/status')) {
      const [, , conversationId] = path.split('/');
      const payload = JSON.parse(request.postData() ?? '{}') as { status?: Conversation['status'] };
      const conversation = state.conversations.find((item) => item.id === conversationId);

      if (!conversation || !payload.status) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid status update' }),
        });
        return;
      }

      conversation.status = payload.status;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(toDetail(conversation)),
      });
      return;
    }

    if (request.method() === 'DELETE' && path.startsWith('/conversations/')) {
      const [, , conversationId] = path.split('/');
      state.conversations = state.conversations.filter((item) => item.id !== conversationId);

      await route.fulfill({
        status: 204,
        contentType: 'application/json',
        body: '',
      });
      return;
    }

    if (request.method() === 'GET' && path === '/config/watch-folders') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          folders: [],
          recommendations: [],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled mock route: ${request.method()} ${path}` }),
    });
  });
};

test.beforeEach(async ({ page }) => {
  await installMocks(page);
  await page.goto('/');
});

test('shows all agents as one mixed recency stream with context labels', async ({ page }) => {
  await page.getByRole('button', { name: 'All Agents' }).click();

  const rows = page.locator('.conversation-item');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('.conv-title')).toHaveText('Gemini release recap');
  await expect(rows.nth(1).locator('.conv-title')).toHaveText('Claude bug fix plan');
  await expect(rows.nth(2).locator('.conv-title')).toHaveText('Codex refactor session');
  await expect(rows.nth(0).locator('.conv-project')).toHaveText('Portal · workspaces/portal/gemini');

  await page.getByRole('button', { name: 'Claude' }).click();
  await expect(page.locator('.conv-project')).toHaveCount(0);
});

test('archives a conversation through the confirmation modal', async ({ page }) => {
  await page.getByRole('button', { name: 'Claude' }).click();
  await page.locator('.conversation-item', { hasText: 'Claude bug fix plan' }).click();

  await page.getByRole('button', { name: 'Archive conversation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Archive Conversation?' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Archive conversation' }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();

  await expect(page.getByRole('status')).toHaveText('Conversation archived.');
  await expect(page.getByText('Archived', { exact: true })).toBeVisible();
});

test('deletes a conversation and selects the next available one', async ({ page }) => {
  await page.getByRole('button', { name: 'All Agents' }).click();
  await page.locator('.conversation-item', { hasText: 'Claude bug fix plan' }).click();

  await expect(page.locator('.detail-header h2')).toHaveText('Claude bug fix plan');

  await page.getByRole('button', { name: 'Delete conversation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(page.getByRole('status')).toHaveText('Conversation deleted.');
  await expect(page.locator('.detail-header h2')).toHaveText('Codex refactor session');
  await expect(page.locator('.conversation-item .conv-title')).not.toContainText(['Claude bug fix plan']);
});

test('copies message text and supports transcript keyboard shortcuts', async ({ page }) => {
  await page.getByRole('button', { name: 'Claude' }).click();
  await page.locator('.conversation-item', { hasText: 'Claude bug fix plan' }).click();

  await page.getByRole('button', { name: 'Copy message text' }).first().click();
  await expect(page.getByRole('status')).toHaveText('Message copied.');
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText))
    .toBe('Investigate the login timeout issue.');

  const searchInput = page.getByPlaceholder('Search this conversation');
  await page.keyboard.press('/');
  await expect(searchInput).toBeFocused();

  await searchInput.fill('retry');
  await expect(page.locator('.prompt-navigation-status').first()).toHaveText('1 / 2');
  await expect(page.locator('mark.message-search-highlight')).toHaveCount(3);

  await page.keyboard.press('Alt+ArrowDown');
  await expect(page.locator('.prompt-navigation-status').first()).toHaveText('2 / 2');

  await page.keyboard.press('Alt+Shift+ArrowDown');
  await expect(page.locator('.prompt-navigation-status').nth(1)).toHaveText('2 / 2');

  await page.locator('body').click();
  await page.keyboard.press('Control+f');
  await expect(searchInput).toBeFocused();
});
