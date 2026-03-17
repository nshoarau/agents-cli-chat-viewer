import path from 'path';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'url';
import { ParserService } from './parserService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '__fixtures__');

describe('ParserService', () => {
  it('extracts Gemini session activity from fixture data', async () => {
    const fixturePath = path.join(fixturesDir, 'gemini-session.json');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('gemini');
    expect(conversation.sessionActivity).toBeDefined();
    expect(conversation.sessionActivity?.commands).toContain('ls -la src');
    expect(conversation.sessionActivity?.filesTouched).toContain('/tmp/project/README.md');
    expect(conversation.sessionActivity?.toolCalls).toHaveLength(3);
    expect(
      conversation.sessionActivity?.toolCalls.some(
        (toolCall) =>
          toolCall.name === 'write_file' && toolCall.diffPreview?.includes('+++ new')
      )
    ).toBe(true);
  });

  it('extracts Codex session activity from fixture data', async () => {
    const fixturePath = path.join(fixturesDir, 'codex-session.jsonl');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('codex');
    expect(conversation.sessionActivity).toBeDefined();
    expect(conversation.sessionActivity?.commands).toContain('cat src/app.ts');
    expect(conversation.sessionActivity?.filesTouched).toContain('src/app.ts');
    expect(
      conversation.sessionActivity?.toolCalls.some(
        (toolCall) => toolCall.outputPreview?.includes("console.log('hello')")
      )
    ).toBe(true);
    expect(
      conversation.sessionActivity?.toolCalls.some(
        (toolCall) =>
          toolCall.name === 'replace' && toolCall.diffPreview?.includes('hello world')
      )
    ).toBe(true);
  });

  it('extracts Claude session activity from fixture data', async () => {
    const fixturePath = path.join(fixturesDir, 'claude-session.jsonl');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('claude');
    expect(conversation.sessionActivity).toBeDefined();
    expect(conversation.sessionActivity?.commands).toContain('npm test');
    expect(conversation.sessionActivity?.filesTouched).toContain('/tmp/claude-project/src/app.ts');
    expect(
      conversation.sessionActivity?.toolCalls.some(
        (toolCall) =>
          toolCall.name === 'Edit' && toolCall.diffPreview?.includes('+++ new')
      )
    ).toBe(true);
  });
});
