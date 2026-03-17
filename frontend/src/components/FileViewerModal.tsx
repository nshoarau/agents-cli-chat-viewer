import React, { useEffect } from 'react';
import { CodeBlock } from './CodeBlock';
import { buildEditorHref, type EditorOptionId } from './fileEditorLink';

interface FileViewerModalProps {
  filePath: string;
  resolvedPath?: string;
  editorPath?: string;
  selectedEditor: EditorOptionId;
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
  content,
  truncated,
  isLoading,
  error,
  onClose,
}) => {
  const displayPath = resolvedPath ?? filePath;
  const editorHref = buildEditorHref(editorPath ?? resolvedPath, selectedEditor);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
              className="confirm-modal-button"
              onClick={() => navigator.clipboard?.writeText(displayPath)}
              title="Copy file path"
            >
              Copy Path
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
