// Fails when a file git would commit (tracked, or untracked and not ignored) contains an email address outside the
// reserved example domains.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', '.twenty', '.yarn', 'coverage', 'dist']);
// Local env files are git-ignored; only the committed template is checked.
const IGNORED_FILE = /^\.env(?!\.example$)/;
const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip|tgz)$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ALLOWED_DOMAIN = /(^|\.)(invalid|example|test|localhost)$|^example\.(com|org|net)$/i;

const listFiles = () => {
  try {
    return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\0')
      // A tracked file deleted in the working tree is still listed.
      .filter((file) => file && existsSync(join(ROOT, file)));
  } catch {
    const walk = (directory) =>
      readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);

        if (statSync(path).isDirectory()) {
          return SKIPPED_DIRECTORIES.has(entry) ? [] : walk(path);
        }

        return IGNORED_FILE.test(entry) ? [] : [relative(ROOT, path)];
      });

    return walk(ROOT);
  }
};

const findings = listFiles()
  .filter((file) => !BINARY_EXTENSIONS.test(file) && file !== 'yarn.lock')
  .flatMap((file) =>
    [...readFileSync(join(ROOT, file), 'utf8').matchAll(EMAIL)]
      .filter(([address]) => !ALLOWED_DOMAIN.test(address.split('@')[1] ?? ''))
      .map(([address]) => `${file}: ${address}`),
  );

if (findings.length > 0) {
  console.error(`Real email addresses found (use @example.invalid instead):\n${findings.join('\n')}`);
  process.exit(1);
}

process.stdout.write('No real email addresses found.\n');
