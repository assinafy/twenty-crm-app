import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const FRONT_COMPONENTS = join(ROOT, 'src', 'front-components');

// Twenty runs front components in a worker inside a sandboxed iframe. That worker is not a secure context, so these
// APIs are undefined there (unit tests run in Node, where they exist).
const SECURE_CONTEXT_ONLY = [/\bcrypto\.randomUUID\b/, /\bcrypto\.subtle\b/, /\bnavigator\.(clipboard|credentials|serviceWorker)\b/];
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*'([^']+)'/g;

const listEntries = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listEntries(path);
    }

    return entry.name.endsWith('.front-component.tsx') ? [path] : [];
  });

// Resolves the app's own imports ('src/…' and relative); packages are left out.
const resolveImport = (specifier: string, importer: string): string | null => {
  const base = specifier.startsWith('src/')
    ? join(ROOT, specifier)
    : specifier.startsWith('.')
      ? join(dirname(importer), specifier)
      : null;

  return base === null
    ? null
    : ([`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((candidate) => existsSync(candidate)) ?? null);
};

// Every source file the front-component bundles include: the entries and everything they import, transitively.
const listBundledSources = (entries: string[]): string[] => {
  const seen = new Set<string>();
  const pending = [...entries];

  for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
    if (seen.has(path)) continue;
    seen.add(path);

    for (const [, specifier] of readFileSync(path, 'utf8').matchAll(IMPORT_SPECIFIER)) {
      const resolved = resolveImport(specifier!, path);
      if (resolved !== null) pending.push(resolved);
    }
  }

  return [...seen].map((path) => relative(ROOT, path)).toSorted();
};

describe('front components', () => {
  const sources = listBundledSources(listEntries(FRONT_COMPONENTS));

  it('scan the shared modules their bundles import, and no server-only module', () => {
    expect(sources).toEqual(
      expect.arrayContaining([
        'src/front-components/components/send-flow.tsx',
        'src/utils/validate-signers.util.ts',
        'src/utils/format-date.util.ts',
        'src/data/find-assinafy-documents.ts',
      ]),
    );
    expect(sources).not.toContain('src/logic-functions/handlers/send-for-signature-workflow.handler.ts');
  });

  it('use no API that the front-component worker lacks', () => {
    const offenders = sources.flatMap((path) => {
      const source = readFileSync(join(ROOT, path), 'utf8');

      return SECURE_CONTEXT_ONLY.filter((pattern) => pattern.test(source)).map((pattern) => `${path}: ${pattern.source}`);
    });

    expect(offenders).toEqual([]);
  });
});
