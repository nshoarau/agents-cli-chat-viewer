const normalizePath = (value: string): string => value.replace(/\\/g, '/');

export const toDisplayFilePath = (filePath: string, projectPath?: string): string => {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedProjectPath = projectPath ? normalizePath(projectPath).replace(/\/+$/, '') : undefined;

  if (normalizedProjectPath && normalizedFilePath.startsWith(`${normalizedProjectPath}/`)) {
    return normalizedFilePath.slice(normalizedProjectPath.length + 1);
  }

  if (normalizedFilePath.startsWith('/')) {
    const segments = normalizedFilePath.split('/').filter(Boolean);
    return segments.slice(-3).join('/') || normalizedFilePath;
  }

  return normalizedFilePath;
};
