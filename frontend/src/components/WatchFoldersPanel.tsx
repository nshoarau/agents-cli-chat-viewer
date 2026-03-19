import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { WatchFolderRecommendation, WatchFoldersResponse } from '../types';

interface WatchFoldersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string, tone?: 'success' | 'error' | 'info') => void;
  shouldHighlightRecommendations?: boolean;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong while updating watched folders.';

export const WatchFoldersPanel: React.FC<WatchFoldersPanelProps> = ({
  isOpen,
  onClose,
  onShowToast,
  shouldHighlightRecommendations = false,
}) => {
  const queryClient = useQueryClient();
  const [folderPath, setFolderPath] = useState('');
  const [label, setLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRecommendationPath, setActiveRecommendationPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuggestedSourcesOpen, setIsSuggestedSourcesOpen] = useState(false);
  const [isCustomPathOpen, setIsCustomPathOpen] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ['watch-folders'],
    queryFn: async () => {
      const response = await apiClient.get<WatchFoldersResponse>('/config/watch-folders');
      return response.data;
    },
    enabled: isOpen,
  });
  const watchFolders = data?.folders ?? [];
  const recommendations = data?.recommendations ?? [];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsSuggestedSourcesOpen(false);
    setIsCustomPathOpen(false);
  }, [isOpen]);

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
    setErrorMessage(null);
    try {
      await apiClient.post('/config/watch-folders', {
        folderPath: folderPath.trim(),
        label: label.trim() || undefined,
      });
      setFolderPath('');
      setLabel('');
      await refreshData();
      onShowToast?.('Watched folder added.');
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      onShowToast?.(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const enableRecommendation = async (recommendation: WatchFolderRecommendation) => {
    setActiveRecommendationPath(recommendation.sourcePath);
    setErrorMessage(null);
    try {
      await apiClient.post('/config/watch-folders', {
        folderPath: recommendation.sourcePath,
        label: recommendation.label,
      });
      await refreshData();
      onShowToast?.(`${recommendation.label} enabled.`);
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      onShowToast?.(message, 'error');
    } finally {
      setActiveRecommendationPath(null);
    }
  };

  const removeFolder = async (id: string) => {
    setErrorMessage(null);
    try {
      await apiClient.delete(`/config/watch-folders/${id}`);
      await refreshData();
      onShowToast?.('Watched folder removed.', 'info');
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      onShowToast?.(message, 'error');
    }
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

        <div className={`watch-folders-onboarding ${shouldHighlightRecommendations ? 'is-highlighted' : ''}`}>
          <div className="watch-folders-onboarding-copy">
            <div className="watch-folders-kicker">Onboarding</div>
            <h3>Connect conversation sources</h3>
            <p>
              Enable detected folders in one click, or add a custom absolute path if your logs live elsewhere.
            </p>
          </div>
        </div>

        {recommendations.length > 0 ? (
          <div className="watch-folders-section watch-folders-section-card">
            <button
              type="button"
              className={`watch-folders-section-toggle ${isSuggestedSourcesOpen ? 'is-open' : ''}`}
              onClick={() => setIsSuggestedSourcesOpen((current) => !current)}
              aria-expanded={isSuggestedSourcesOpen}
            >
              <span className="watch-folders-section-header">
                <h3>Suggested Sources</h3>
                <span>{recommendations.length} available</span>
              </span>
              <span className="watch-folders-section-chevron" aria-hidden="true">▾</span>
            </button>
            {isSuggestedSourcesOpen ? (
              <>
                <div className="watch-folders-inline-hint">
                  <span className="watch-folders-inline-hint-badge">Auto</span>
                  <span className="watch-folders-inline-hint-copy">
                    One-click sources found automatically. If an agent stores chats somewhere custom,
                    use the manual path below and point the app at the exact folder or exported transcript.
                  </span>
                </div>
                <div className="watch-folders-list watch-folders-suggested-list">
                {recommendations.map((folder) => (
                  <div key={folder.sourcePath} className="watch-folder-item watch-folder-item-recommended">
                    <div className="watch-folder-meta">
                      <div className="watch-folder-label-row">
                        <strong>{folder.label}</strong>
                        <span className="watch-folder-kind kind-default">suggested</span>
                      </div>
                      <div className="watch-folder-path">{folder.sourcePath}</div>
                    </div>
                    <button
                      className="btn-add-folder"
                      onClick={() => enableRecommendation(folder)}
                      disabled={activeRecommendationPath === folder.sourcePath}
                    >
                      {activeRecommendationPath === folder.sourcePath ? 'Enabling...' : 'Enable'}
                    </button>
                  </div>
                ))}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="watch-folders-empty watch-folders-section-card">
            No default agent folders were detected automatically. Add a custom path below.
          </div>
        )}

        <div className="watch-folders-section watch-folders-section-card">
          <button
            type="button"
            className={`watch-folders-section-toggle ${isCustomPathOpen ? 'is-open' : ''}`}
            onClick={() => setIsCustomPathOpen((current) => !current)}
            aria-expanded={isCustomPathOpen}
          >
            <span className="watch-folders-section-header">
              <h3>Custom Path</h3>
              <span>Manual</span>
            </span>
            <span className="watch-folders-section-chevron" aria-hidden="true">▾</span>
          </button>

          {isCustomPathOpen ? (
            <div className="watch-folders-form">
              <div className="watch-folders-inline-hint">
                <span className="watch-folders-inline-hint-badge">Tip</span>
                Use an absolute path to a folder or one conversation file. For Cursor, prefer the workspace-storage folders for native history or a folder of exported markdown chats. Add a label only if you want a custom display name.
              </div>
              <div className="watch-folders-field-label">Absolute path to a folder or single supported log file</div>
              <input
                type="text"
                placeholder="Absolute path"
                value={folderPath}
                onChange={(event) => setFolderPath(event.target.value)}
              />
              <div className="watch-folders-field-label">Optional display label shown in Enabled Sources</div>
              <input
                type="text"
                placeholder="Optional label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
              <button
                className="btn-add-folder"
                onClick={addFolder}
                disabled={isSubmitting}
              >
                Add Folder
              </button>
              <div className="watch-folders-field-label">
                Adding a source rebuilds the index so matching conversations appear in the dashboard.
              </div>
            </div>
          ) : null}
        </div>

        {isPending ? <div className="watch-folders-empty">Loading watch folders...</div> : null}
        {error ? <div className="watch-folders-error">Failed to load watch folders.</div> : null}
        {errorMessage ? <div className="watch-folders-error">{errorMessage}</div> : null}

        <div className="watch-folders-section watch-folders-section-card">
          <div className="watch-folders-section-header">
            <h3>Enabled Sources</h3>
            <span>{watchFolders.length}</span>
          </div>
          <div className="watch-folders-inline-hint">
            <span className="watch-folders-inline-hint-badge">Live</span>
            These sources are currently indexed. Remove one to stop mirroring and hide its conversations after reindexing.
          </div>
          {watchFolders.length === 0 ? (
            <div className="watch-folders-empty">No watched folders are enabled yet.</div>
          ) : (
            <div className="watch-folders-list watch-folders-enabled-list">
              {watchFolders.map((folder) => (
                <div key={folder.id} className="watch-folder-item">
                  <div className="watch-folder-meta">
                    <div className="watch-folder-label-row">
                      <strong>{folder.label}</strong>
                      <span className={`watch-folder-kind kind-${folder.kind}`}>{folder.kind}</span>
                    </div>
                    <div className="watch-folder-path">{folder.sourcePath}</div>
                  </div>
                  <button
                    className="btn-remove-folder"
                    onClick={() => removeFolder(folder.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
