const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const GENERIC_PATH_PATTERN =
  /(?:^|[\s([{"'`])((?:\/[\w.@-]+)+|(?:\.{1,2}\/)?(?:[\w-]+\/)+[\w.@-]+|(?:\.{1,2}\/)?[\w-]+(?:\/[\w.-]+)*\.[A-Za-z0-9]+)\b/g;
const EXTENSIONLESS_FILE_NAMES = new Set([
  'dockerfile',
  'makefile',
  'gemfile',
  'procfile',
  'rakefile',
  'justfile',
  'brewfile',
  'podfile',
  'cartfile',
  'vagrantfile',
  'jenkinsfile',
]);

const normalizeCandidate = (value: string): string => value.trim().replace(/[),.:;!?]+$/, '');

const isDomainLike = (value: string): boolean =>
  /^(?:\d{1,3}\.){1,3}\d{1,3}(?::\d+)?$/.test(value) ||
  /^(?:localhost|(?:[\w-]+\.)+[A-Za-z]{2,})(?::\d+)?$/.test(value) ||
  /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/|$)/.test(value) ||
  /^(?:localhost|(?:[\w-]+\.)+[A-Za-z]{2,})(?::\d+)?(?:\/|$)/.test(value);

const hasFileLikeBaseName = (value: string): boolean => {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');
  const baseName = normalized.split('/').pop() ?? normalized;
  const lowerBaseName = baseName.toLocaleLowerCase();

  return (
    lowerBaseName.includes('.') ||
    lowerBaseName.startsWith('.') ||
    EXTENSIONLESS_FILE_NAMES.has(lowerBaseName)
  );
};

export const isPreviewablePathReference = (value: string): boolean => {
  if (
    !value ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    value.startsWith('#') ||
    isDomainLike(value)
  ) {
    return false;
  }

  return hasFileLikeBaseName(value);
};

export const extractMessageFileReferences = (content: string): string[] => {
  const references = new Set<string>();

  for (const match of content.matchAll(MARKDOWN_LINK_PATTERN)) {
    const candidate = normalizeCandidate(match[1] ?? '');
    if (isPreviewablePathReference(candidate)) {
      references.add(candidate);
    }
  }

  const contentWithoutMarkdownLinks = content.replace(MARKDOWN_LINK_PATTERN, ' ');

  for (const match of contentWithoutMarkdownLinks.matchAll(GENERIC_PATH_PATTERN)) {
    const candidate = normalizeCandidate(match[1] ?? '');
    if (isPreviewablePathReference(candidate)) {
      references.add(candidate);
    }
  }

  return [...references];
};
