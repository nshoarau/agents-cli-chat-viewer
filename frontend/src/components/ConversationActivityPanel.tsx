import React from 'react';
import type { ActivityToolCall } from '../types';
import { CodeBlock } from './CodeBlock';
import { DiffPreview } from './DiffPreview';
import { toDisplayFilePath } from './displayFilePath';

interface ConversationActivityPanelProps {
  commands: string[];
  filesTouched: string[];
  toolCalls: ActivityToolCall[];
  projectPath?: string;
  onOpenFile: (filePath: string) => void;
}

export const ConversationActivityPanel: React.FC<ConversationActivityPanelProps> = ({
  commands,
  filesTouched,
  toolCalls,
  projectPath,
  onOpenFile,
}) => {
  return (
    <div className="prompt-activity-panel">
      <div className="prompt-activity-summary">
        {commands.length} commands, {filesTouched.length} files, {toolCalls.length} tool calls
      </div>
      {filesTouched.length > 0 ? (
        <div className="activity-section">
          <h4>Files Touched</h4>
          <div className="activity-chip-list">
            {filesTouched.map((filePath) => (
              <button
                key={filePath}
                type="button"
                className="activity-chip activity-file-button"
                onClick={() => onOpenFile(filePath)}
                title={filePath}
              >
                {toDisplayFilePath(filePath, projectPath)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {commands.length > 0 ? (
        <div className="activity-section">
          <h4>Commands</h4>
          <div className="activity-code-list">
            {commands.map((command, commandIndex) => (
              <CodeBlock key={`${command}-${commandIndex}`} language="bash" value={command} />
            ))}
          </div>
        </div>
      ) : null}
      {toolCalls.length > 0 ? (
        <div className="activity-section">
          <h4>Tool Activity</h4>
          <div className="tool-call-list">
            {toolCalls.map((toolCall, toolIndex) => (
              <div key={toolCall.id || `${toolCall.name}-${toolIndex}`} className="tool-call-card">
                <div className="tool-call-head">
                  <div className="tool-call-meta">
                    <span className={`tool-kind tool-kind-${toolCall.kind}`}>{toolCall.kind}</span>
                    <span className="tool-name">{toolCall.name}</span>
                    {toolCall.status ? <span className="tool-status">{toolCall.status}</span> : null}
                  </div>
                  {toolCall.timestamp ? (
                    <span className="tool-time">
                      {new Date(toolCall.timestamp).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                {toolCall.filePath ? (
                  <button
                    type="button"
                  className="tool-file-path tool-file-path-button"
                  onClick={() => onOpenFile(toolCall.filePath!)}
                  title={toolCall.filePath}
                >
                    {toDisplayFilePath(toolCall.filePath, projectPath)}
                  </button>
                ) : null}
                {toolCall.command ? (
                  <CodeBlock language="bash" value={toolCall.command} />
                ) : toolCall.summary ? (
                  <div className="tool-summary">{toolCall.summary}</div>
                ) : null}
                {toolCall.diffPreview ? (
                  <div className="tool-detail-block">
                    <div className="tool-detail-label">File Diff</div>
                    <DiffPreview value={toolCall.diffPreview} />
                  </div>
                ) : toolCall.kind === 'write' ? (
                  <div className="tool-detail-note">Change recorded, but no diff was captured in the session log.</div>
                ) : null}
                {toolCall.outputPreview ? (
                  <div className="tool-detail-block">
                    <div className="tool-detail-label">Output</div>
                    <CodeBlock language="text" value={toolCall.outputPreview} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
