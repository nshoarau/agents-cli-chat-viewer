import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileViewerModal } from './FileViewerModal';

describe('FileViewerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it('shows copied feedback after copying the file path', async () => {
    render(
      <FileViewerModal
        filePath="src/app.ts"
        resolvedPath="/tmp/project/src/app.ts"
        selectedEditor="vscode"
        content="console.log('preview');"
        truncated={false}
        isLoading={false}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy file path' }));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/tmp/project/src/app.ts')
    );
    expect(screen.getByRole('button', { name: 'File path copied' })).toBeInTheDocument();
  });

  it('shows a raw fallback and structured status message for non-text previews', () => {
    render(
      <FileViewerModal
        filePath="image.bin"
        resolvedPath="/tmp/project/image.bin"
        selectedEditor="vscode"
        content=""
        truncated={false}
        previewStatus="binary"
        previewMessage="Binary files cannot be previewed as text. Open the raw file instead."
        rawUrl="/api/conversations/conv-preview/files/raw?path=image.bin"
        isLoading={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Binary files cannot be previewed as text. Open the raw file instead.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Raw' })).toHaveAttribute(
      'href',
      '/api/conversations/conv-preview/files/raw?path=image.bin'
    );
  });
});
