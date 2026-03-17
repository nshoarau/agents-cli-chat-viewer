import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span>{language || 'text'}</span>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'visible' }}
        wrapLongLines
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};
