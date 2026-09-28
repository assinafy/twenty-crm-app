import { describe, expect, it } from 'vitest';

import { signedFileLabel } from 'src/utils/signed-file-label.util';

describe('signedFileLabel', () => {
  it('labels each artifact', () => {
    expect(signedFileLabel('Service agreement', 'certificated')).toBe('Service agreement - assinado.pdf');
    expect(signedFileLabel('Service agreement', 'pades')).toBe('Service agreement - ICP-Brasil.pdf');
  });

  it('removes forbidden and control characters and a trailing .pdf', () => {
    expect(signedFileLabel(' a/b\\c:d*e?f"g<h>i|j\u0000k\nl.PDF ', 'certificated')).toBe('a b c d e f g h i j k l - assinado.pdf');
  });

  it('truncates long names to 150 code points without splitting emoji', () => {
    const label = signedFileLabel(`${'x'.repeat(149)}😀😀`, 'certificated');
    expect(label).toBe(`${'x'.repeat(149)}😀 - assinado.pdf`);
  });

  it.each([null, '', '  ', '///', '.pdf'])('falls back to "documento" for %o', (name) => {
    expect(signedFileLabel(name, 'pades')).toBe('documento - ICP-Brasil.pdf');
  });
});
