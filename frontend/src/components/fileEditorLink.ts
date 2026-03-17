export type EditorOptionId = 'default' | 'none' | 'vscode' | 'cursor' | 'zed' | 'windsurf' | 'jetbrains';
export type JetBrainsProductId = 'idea' | 'php-storm' | 'web-storm' | 'pycharm' | 'goland' | 'rubymine';

export const EDITOR_OPTIONS: Array<{ id: EditorOptionId; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'zed', label: 'Zed' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'jetbrains', label: 'JetBrains' },
  { id: 'none', label: 'Disabled' },
];

export const JETBRAINS_PRODUCT_OPTIONS: Array<{ id: JetBrainsProductId; label: string }> = [
  { id: 'idea', label: 'IntelliJ IDEA' },
  { id: 'php-storm', label: 'PhpStorm' },
  { id: 'web-storm', label: 'WebStorm' },
  { id: 'pycharm', label: 'PyCharm' },
  { id: 'goland', label: 'GoLand' },
  { id: 'rubymine', label: 'RubyMine' },
];

const isAbsolutePath = (value: string): boolean =>
  value.startsWith('/') ||
  value.startsWith('\\\\') ||
  /^[A-Za-z]:[\\/]/.test(value);

const normalizePathForUri = (value: string): string => {
  const normalizedPath = value.replace(/\\/g, '/');
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};

const normalizePathForQuery = (value: string): string =>
  value.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(value)
    ? value
    : normalizePathForUri(value);

const normalizePath = (value: string): string => value.replace(/\\/g, '/');

const toJetBrainsPath = (resolvedPath: string, projectPath?: string): string => {
  const normalizedResolvedPath = normalizePath(resolvedPath);
  const normalizedProjectPath = projectPath ? normalizePath(projectPath).replace(/\/+$/, '') : undefined;

  if (normalizedProjectPath && normalizedResolvedPath.startsWith(`${normalizedProjectPath}/`)) {
    return normalizedResolvedPath.slice(normalizedProjectPath.length + 1);
  }

  return normalizePathForQuery(resolvedPath);
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
  selectedEditor: EditorOptionId = 'default',
  options?: {
    jetbrainsProduct?: JetBrainsProductId;
    jetbrainsProjectName?: string;
    projectPath?: string;
  }
): string | null => {
  if (!resolvedPath || !isAbsolutePath(resolvedPath)) {
    return null;
  }

  if (selectedEditor === 'none') {
    return null;
  }

  const normalizedPath = normalizePathForUri(resolvedPath);
  const encodedPath = encodeURI(normalizedPath);
  const template =
    selectedEditor === 'default'
      ? import.meta.env.VITE_EDITOR_URI_TEMPLATE || DEFAULT_EDITOR_URI_TEMPLATE
      : selectedEditor === 'jetbrains'
        ? (() => {
            const product = options?.jetbrainsProduct ?? 'idea';
            const jetBrainsPath = encodeURIComponent(toJetBrainsPath(resolvedPath, options?.projectPath));
            const project = options?.jetbrainsProjectName
              ? `project=${encodeURIComponent(options.jetbrainsProjectName)}&`
              : '';
            return `jetbrains://${product}/navigate/reference?${project}path=${jetBrainsPath}`;
          })()
      : EDITOR_URI_TEMPLATES[selectedEditor];

  if (!template.includes('{{path}}')) {
    return template;
  }

  return template.replaceAll('{{path}}', encodedPath);
};
