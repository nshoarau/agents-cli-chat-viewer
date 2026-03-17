import React from 'react';
import type { ConversationFileGroup, ConversationFileSource } from './conversationFilesPanelUtils';

interface ConversationFilesPanelProps {
  groups: ConversationFileGroup[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onOpenFullList: () => void;
  onOpenFile: (filePath: string) => void;
}

const SOURCE_LABELS: Record<ConversationFileSource, string> = {
  prompt: 'Prompt',
  activity: 'Activity',
  both: 'Both',
};

export const ConversationFilesPanel: React.FC<ConversationFilesPanelProps> = ({
  groups,
  isExpanded,
  onToggleExpanded,
  onOpenFullList,
  onOpenFile,
}) => {
  if (groups.length === 0) {
    return null;
  }

  const fileCount = groups.reduce((total, group) => total + group.files.length, 0);

  return (
    <section className="conversation-files-panel" aria-label="Files">
      <div className="conversation-files-panel-header">
        <div>
          <h3>Files</h3>
          <p>
            {fileCount} files across {groups.length} folders, sorted by recency and frequency.
          </p>
        </div>
        <div className="conversation-files-panel-actions">
          <button
            type="button"
            className="conversation-files-toggle"
            onClick={onOpenFullList}
          >
            Open Full List
          </button>
          <button
            type="button"
            className="conversation-files-toggle"
            onClick={onToggleExpanded}
            aria-expanded={isExpanded}
            aria-controls="conversation-files-groups"
          >
            {isExpanded ? 'Hide Files' : `Show Files (${fileCount})`}
          </button>
        </div>
      </div>
      {isExpanded ? (
      <div className="conversation-files-groups" id="conversation-files-groups">
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
      ) : null}
    </section>
  );
};
