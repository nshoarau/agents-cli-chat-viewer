import React, { useEffect, useRef, useState } from 'react';
import { CodeBlock } from './CodeBlock';
import { buildEditorHref, type EditorOptionId, type JetBrainsProductId } from './fileEditorLink';

interface FileViewerModalProps {
  filePath: string;
  resolvedPath?: string;
  editorPath?: string;
  selectedEditor: EditorOptionId;
  jetbrainsProduct: JetBrainsProductId;
  jetbrainsProjectName?: string;
  projectPath?: string;
  content: string;
  truncated: boolean;
  isLoading: boolean;
  error?: string;
  onClose: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  filePath,
  resolvedPath,
  editorPath,
  selectedEditor,
  jetbrainsProduct,
  jetbrainsProjectName,
  projectPath,
  content,
  truncated,
  isLoading,
  error,
  onClose,
}) => {
  const displayPath = resolvedPath ?? filePath;
  const editorHref = buildEditorHref(editorPath ?? resolvedPath, selectedEditor, {
    jetbrainsProduct,
    jetbrainsProjectName,
    projectPath,
  });
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, [onClose]);

  const handleCopyPath = async () => {
    if (!navigator.clipboard) {
      setCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(displayPath);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      resetTimerRef.current = null;
    }, 1600);
  };

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div
        className="confirm-modal file-viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-viewer-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="file-viewer-header">
          <div>
            <h3 id="file-viewer-modal-title">File Preview</h3>
            <div className="file-viewer-path">{displayPath}</div>
          </div>
          <div className="file-viewer-actions">
            {editorHref ? (
              <a
                className="confirm-modal-button file-viewer-open-link"
                href={editorHref}
                title={`Open ${displayPath} in your configured editor`}
              >
                Open in IDE
              </a>
            ) : null}
            <button
              type="button"
              className={`confirm-modal-button file-viewer-copy-button ${
                copyState !== 'idle' ? `is-${copyState}` : ''
              }`}
              onClick={() => void handleCopyPath()}
              aria-label={copyState === 'copied' ? 'File path copied' : 'Copy file path'}
              title={
                copyState === 'copied'
                  ? 'Copied'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : 'Copy file path'
              }
            >
              {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Retry' : 'Copy Path'}
            </button>
            <button type="button" className="confirm-modal-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {isLoading ? <div className="file-viewer-state">Loading file preview...</div> : null}
        {!isLoading && error ? <div className="file-viewer-state file-viewer-error">{error}</div> : null}
        {!isLoading && !error ? (
          <div className="file-viewer-content">
            {truncated ? (
              <div className="file-viewer-state">Preview truncated to keep the viewer responsive.</div>
            ) : null}
            <CodeBlock language="text" value={content} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
