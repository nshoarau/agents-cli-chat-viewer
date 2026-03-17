import React, { useEffect } from 'react';
import type { ConversationFileGroup, ConversationFileSource } from './conversationFilesPanelUtils';

interface ConversationFilesModalProps {
  groups: ConversationFileGroup[];
  onOpenFile: (filePath: string) => void;
  onClose: () => void;
}

const SOURCE_LABELS: Record<ConversationFileSource, string> = {
  prompt: 'Prompt',
  activity: 'Activity',
  both: 'Both',
};

export const ConversationFilesModal: React.FC<ConversationFilesModalProps> = ({
  groups,
  onOpenFile,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fileCount = groups.reduce((total, group) => total + group.files.length, 0);

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div
        className="confirm-modal conversation-files-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversation-files-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="file-viewer-header">
          <div>
            <h3 id="conversation-files-modal-title">All Files</h3>
            <div className="file-viewer-path">
              {fileCount} files across {groups.length} folders.
            </div>
          </div>
          <div className="file-viewer-actions">
            <button type="button" className="confirm-modal-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="conversation-files-groups conversation-files-groups-modal">
          {groups.map((group) => (
            <div key={group.folderPath} className="conversation-files-group">
              <div className="conversation-files-group-header">
                <span className="conversation-files-folder">{group.folderPath}</span>
                <span className="conversation-files-folder-count">{group.files.length}</span>
              </div>
              <div className="conversation-files-list">
                {group.files.map((file) => (
                  <button
                    key={file.filePath}
                    type="button"
                    className="conversation-files-item"
                    onClick={() => onOpenFile(file.filePath)}
                    aria-label={file.displayPath}
                    title={file.filePath}
                  >
                    <span className="conversation-files-item-path">{file.displayPath}</span>
                    <span className="conversation-files-item-meta">
                      <span className={`conversation-files-source is-${file.source}`}>
                        {SOURCE_LABELS[file.source]}
                      </span>
                      <span className="conversation-files-frequency">{file.frequency}x</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
