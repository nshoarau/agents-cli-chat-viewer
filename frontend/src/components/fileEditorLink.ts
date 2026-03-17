export type EditorOptionId = 'default' | 'none' | 'vscode' | 'cursor' | 'zed' | 'windsurf' | 'jetbrains';

export const EDITOR_OPTIONS: Array<{ id: EditorOptionId; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'zed', label: 'Zed' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'jetbrains', label: 'JetBrains' },
  { id: 'none', label: 'Disabled' },
];

const isAbsolutePath = (value: string): boolean =>
  value.startsWith('/') ||
  value.startsWith('\\\\') ||
  /^[A-Za-z]:[\\/]/.test(value);

const normalizePathForUri = (value: string): string => {
  const normalizedPath = value.replace(/\\/g, '/');
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};

const DEFAULT_EDITOR_URI_TEMPLATE = 'vscode://file{{path}}';
const EDITOR_URI_TEMPLATES: Record<Exclude<EditorOptionId, 'default' | 'none' | 'jetbrains'>, string> = {
  vscode: 'vscode://file{{path}}',
  cursor: 'cursor://file{{path}}',
  zed: 'zed://file{{path}}',
  windsurf: 'windsurf://file{{path}}',
};

export const buildEditorHref = (
  resolvedPath?: string,
  selectedEditor: EditorOptionId = 'default'
): string | null => {
  if (!resolvedPath || !isAbsolutePath(resolvedPath)) {
    return null;
  }

  if (selectedEditor === 'none') {
    return null;
  }

  const normalizedPath = normalizePathForUri(resolvedPath);
  const encodedPath = encodeURI(normalizedPath);
  const encodedQueryPath = encodeURIComponent(normalizedPath);
  const template =
    selectedEditor === 'default'
      ? import.meta.env.VITE_EDITOR_URI_TEMPLATE || DEFAULT_EDITOR_URI_TEMPLATE
      : selectedEditor === 'jetbrains'
        ? `jetbrains://idea/navigate/reference?path=${encodedQueryPath}`
      : EDITOR_URI_TEMPLATES[selectedEditor];

  if (!template.includes('{{path}}')) {
    return template;
  }

  return template.replaceAll('{{path}}', encodedPath);
};
