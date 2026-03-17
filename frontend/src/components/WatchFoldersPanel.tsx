import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { WatchFolderEntry } from '../types';

interface WatchFoldersPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WatchFoldersPanel: React.FC<WatchFoldersPanelProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [folderPath, setFolderPath] = useState('');
  const [label, setLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: watchFolders = [], isPending, error } = useQuery({
    queryKey: ['watch-folders'],
    queryFn: async () => {
      const response = await apiClient.get<WatchFolderEntry[]>('/config/watch-folders');
      return response.data;
    },
    enabled: isOpen,
  });

  if (!isOpen) {
    return null;
  }

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['watch-folders'] }),
      queryClient.invalidateQueries({ queryKey: ['conversations'] }),
    ]);
  };

  const addFolder = async () => {
    if (!folderPath.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/config/watch-folders', {
        folderPath: folderPath.trim(),
        label: label.trim() || undefined,
      });
      setFolderPath('');
      setLabel('');
      await refreshData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFolder = async (id: string) => {
    await apiClient.delete(`/config/watch-folders/${id}`);
    await refreshData();
  };

  return (
    <div className="watch-folders-overlay" onClick={onClose}>
      <div
        className="watch-folders-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="watch-folders-header">
          <h2>Watched Folders</h2>
          <button className="watch-folders-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="watch-folders-form">
          <input
            type="text"
            placeholder="Absolute path"
            value={folderPath}
            onChange={(event) => setFolderPath(event.target.value)}
          />
          <input
            type="text"
            placeholder="Optional label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <button className="btn-add-folder" onClick={addFolder} disabled={isSubmitting}>
            Add Folder
          </button>
        </div>

        {isPending ? <div className="watch-folders-empty">Loading watch folders...</div> : null}
        {error ? <div className="watch-folders-error">Failed to load watch folders.</div> : null}

        <div className="watch-folders-list">
          {watchFolders.map((folder) => (
            <div key={folder.id} className="watch-folder-item">
              <div className="watch-folder-meta">
                <div className="watch-folder-label-row">
                  <strong>{folder.label}</strong>
                  <span className={`watch-folder-kind kind-${folder.kind}`}>{folder.kind}</span>
                </div>
                <div className="watch-folder-path">{folder.sourcePath}</div>
              </div>
              <button className="btn-remove-folder" onClick={() => removeFolder(folder.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
