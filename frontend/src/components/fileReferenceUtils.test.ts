import { describe, expect, it } from 'vitest';
import { extractMessageFileReferences, isPreviewablePathReference } from './fileReferenceUtils';

describe('fileReferenceUtils', () => {
  it('keeps file-like references and rejects folders, refs, and bare hosts', () => {
    expect(isPreviewablePathReference('src/app.ts')).toBe(true);
    expect(isPreviewablePathReference('.github/workflows/ci.yml')).toBe(true);
    expect(isPreviewablePathReference('Dockerfile')).toBe(true);

    expect(isPreviewablePathReference('origin/main')).toBe(false);
    expect(isPreviewablePathReference('src/components')).toBe(false);
    expect(isPreviewablePathReference('127.0.0.1/api')).toBe(false);
    expect(isPreviewablePathReference('example.com/path')).toBe(false);
  });

  it('extracts only file references from mixed message content', () => {
    const references = extractMessageFileReferences(
      'Review [src/app.ts](src/app.ts), not origin/main, src/components, or 127.0.0.1/api.'
    );

    expect(references).toEqual(['src/app.ts']);
  });
});
