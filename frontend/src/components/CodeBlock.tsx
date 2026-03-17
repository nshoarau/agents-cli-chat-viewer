import React, { useEffect, useState } from 'react';

interface CodeBlockProps {
  language?: string;
  value: string;
}

type SyntaxHighlighterModule = typeof import('react-syntax-highlighter');
type PrismStyleModule = typeof import('react-syntax-highlighter/dist/esm/styles/prism');

interface LoadedHighlighter {
  SyntaxHighlighter: SyntaxHighlighterModule['Prism'];
  style: PrismStyleModule['vscDarkPlus'];
}

let loadedHighlighterPromise: Promise<LoadedHighlighter> | null = null;

const loadHighlighter = (): Promise<LoadedHighlighter> => {
  if (!loadedHighlighterPromise) {
    loadedHighlighterPromise = Promise.all([
      import('react-syntax-highlighter'),
      import('react-syntax-highlighter/dist/esm/styles/prism'),
    ]).then(([syntaxHighlighterModule, styleModule]) => ({
      SyntaxHighlighter: syntaxHighlighterModule.Prism,
      style: styleModule.vscDarkPlus,
    }));
  }

  return loadedHighlighterPromise;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [loadedHighlighter, setLoadedHighlighter] = useState<LoadedHighlighter | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadHighlighter().then((resolvedHighlighter) => {
      if (!cancelled) {
        setLoadedHighlighter(resolvedHighlighter);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span>{language || 'text'}</span>
      </div>
      {loadedHighlighter ? (
        <loadedHighlighter.SyntaxHighlighter
          language={language || 'text'}
          style={loadedHighlighter.style}
          customStyle={{
            margin: 0,
            borderRadius: '0 0 8px 8px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowX: 'visible',
          }}
          wrapLongLines
        >
          {value}
        </loadedHighlighter.SyntaxHighlighter>
      ) : (
        <pre className="code-block-fallback">
          <code>{value}</code>
        </pre>
      )}
    </div>
  );
};
