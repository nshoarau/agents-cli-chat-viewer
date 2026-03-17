import { afterEach, describe, expect, it } from 'vitest';
import { buildEditorHref } from './fileEditorLink';

describe('buildEditorHref', () => {
  afterEach(() => {
    delete import.meta.env.VITE_EDITOR_URI_TEMPLATE;
  });

  it('uses the default VS Code URI template', () => {
    expect(buildEditorHref('/tmp/project/src/app.ts')).toBe('vscode://file/tmp/project/src/app.ts');
  });

  it('supports a configurable editor URI template', () => {
    import.meta.env.VITE_EDITOR_URI_TEMPLATE = 'zed://file{{path}}';

    expect(buildEditorHref('/tmp/project/src/app.ts', 'default')).toBe('zed://file/tmp/project/src/app.ts');
  });

  it('returns null for non-absolute paths', () => {
    expect(buildEditorHref('src/app.ts')).toBeNull();
  });

  it('supports explicit editor selections', () => {
    expect(buildEditorHref('/tmp/project/src/app.ts', 'cursor')).toBe('cursor://file/tmp/project/src/app.ts');
    expect(buildEditorHref('/tmp/project/src/app.ts', 'jetbrains')).toBe(
      'jetbrains://idea/navigate/reference?path=%2Ftmp%2Fproject%2Fsrc%2Fapp.ts'
    );
    expect(buildEditorHref('/tmp/project/src/app.ts', 'none')).toBeNull();
  });

  it('supports WSL UNC paths for editor links', () => {
    expect(buildEditorHref('\\\\wsl.localhost\\Ubuntu-24.04\\home\\me\\src\\app.ts', 'vscode')).toBe(
      'vscode://file//wsl.localhost/Ubuntu-24.04/home/me/src/app.ts'
    );
  });
});
