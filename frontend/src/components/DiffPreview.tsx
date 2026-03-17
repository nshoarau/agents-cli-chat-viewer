import React from 'react';

interface DiffPreviewProps {
  value: string;
}

interface ParsedLine {
  kind: 'header' | 'add' | 'remove' | 'context';
  text: string;
}

const parseDiff = (value: string): ParsedLine[] =>
  value.split('\n').map((line) => {
    if (line.startsWith('+++') || line.startsWith('---')) {
      return { kind: 'header', text: line };
    }
    if (line.startsWith('+')) {
      return { kind: 'add', text: line };
    }
    if (line.startsWith('-')) {
      return { kind: 'remove', text: line };
    }
    return { kind: 'context', text: line };
  });

export const DiffPreview: React.FC<DiffPreviewProps> = ({ value }) => {
  const lines = parseDiff(value);

  return (
    <div className="diff-preview">
      <div className="diff-preview-header">diff</div>
      <div className="diff-preview-body">
        {lines.map((line, index) => (
          <div key={`${line.kind}-${index}`} className={`diff-line diff-line-${line.kind}`}>
            <span className="diff-gutter">
              {line.kind === 'add'
                ? '+'
                : line.kind === 'remove'
                  ? '-'
                  : line.kind === 'header'
                    ? '@'
                    : ' '}
            </span>
            <code>{line.text}</code>
          </div>
        ))}
      </div>
    </div>
  );
};
