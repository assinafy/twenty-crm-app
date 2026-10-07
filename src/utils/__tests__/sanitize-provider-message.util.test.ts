import { describe, expect, it } from 'vitest';

import { PROVIDER_MESSAGE_MAX_LENGTH } from 'src/constants/limits';
import { sanitizeProviderMessage } from 'src/utils/sanitize-provider-message.util';

describe('sanitizeProviderMessage', () => {
  it('keeps a plain message untouched', () => {
    expect(sanitizeProviderMessage('Documento não pode ser enviado.')).toBe('Documento não pode ser enviado.');
  });

  it('redacts emails', () => {
    expect(sanitizeProviderMessage('Signer ana.souza@example.invalid already exists')).toBe(
      'Signer [e-mail] already exists',
    );
  });

  it('hides a link carrying an address whole', () => {
    const message = 'Open https://sign.test.invalid/secret-link?u=a@b.c now or www.test.invalid/x';

    expect(sanitizeProviderMessage(message)).toBe('Open [e-mail] now or [link]');
  });

  it.each([
    ['Signer ana.souza@www.example.invalid exists', 'Signer [e-mail] exists'],
    ['x fulano.www.silva@example.invalid', 'x [e-mail]'],
    ['Signer ana.souza@example.invalid/abc exists', 'Signer [e-mail] exists'],
    ['x ana.souza@my-host.example/abc', 'x [e-mail]'],
    ['Duplicados: ana.souza@example.invalid/joao.lima@example.invalid', 'Duplicados: [e-mail]@example.invalid'],
  ])('hides the whole address when its domain looks like a link: %s', (message, expected) => {
    expect(sanitizeProviderMessage(message)).toBe(expected);
  });

  it.each([
    'ver_app.test.invalid/sign/TOKEN123',
    '_www.test.invalid/TOKEN123',
    'veja.https://sign.test.invalid?token=TOKEN123',
    'Link:https://sign.test.invalid?token=TOKEN123',
    'ana@example.invalid;joao@www.example.invalid/TOKEN123',
    'user@sign.test.invalid/TOKEN123',
  ])('still hides the token of a link: %s', (message) => {
    expect(sanitizeProviderMessage(message)).not.toContain('TOKEN123');
  });

  it('redacts government ids and phones written with separators', () => {
    expect(sanitizeProviderMessage('CPF 123.456.789-09, CNPJ 12.345.678/0001-90, phone +55 (11) 90000-0000')).toBe(
      'CPF [número], CNPJ [número], phone [número]',
    );
  });

  it('redacts alphanumeric CNPJs, with or without separators', () => {
    expect(sanitizeProviderMessage('CNPJ 12.ABC.345/01DE-35 or 12abc34501de35 is invalid')).toBe(
      'CNPJ [número] or [número] is invalid',
    );
  });

  it('redacts landlines with DDD (10 digits)', () => {
    expect(sanitizeProviderMessage('Call (11) 3333-4444 or 1133334444')).toBe('Call [número] or [número]');
  });

  it('keeps digit runs shorter than 10 digits', () => {
    expect(sanitizeProviderMessage('Max 2000 pages, expires 2026-09-25, CEP 01310-100, code 123456789')).toBe(
      'Max 2000 pages, expires 2026-09-25, CEP 01310-100, code 123456789',
    );
  });

  it('redacts a bare domain with a path, which can be a signing link, but keeps one without a path', () => {
    expect(sanitizeProviderMessage('Assine em app.test.invalid/sign/abc123 ou veja test.invalid.')).toBe(
      'Assine em [link] ou veja test.invalid.',
    );
  });

  it('collapses whitespace', () => {
    expect(sanitizeProviderMessage('  line one\n\n\tline   two ')).toBe('line one line two');
  });

  it('truncates to the maximum length with an ellipsis', () => {
    const exact = 'a'.repeat(PROVIDER_MESSAGE_MAX_LENGTH);
    expect(sanitizeProviderMessage(exact)).toBe(exact);

    const truncated = sanitizeProviderMessage('a'.repeat(PROVIDER_MESSAGE_MAX_LENGTH + 1));
    expect(truncated).toHaveLength(PROVIDER_MESSAGE_MAX_LENGTH);
    expect(truncated.endsWith('…')).toBe(true);
  });

  it('never splits a surrogate pair when truncating', () => {
    const truncated = sanitizeProviderMessage(`${'a'.repeat(PROVIDER_MESSAGE_MAX_LENGTH - 2)}😀😀`);

    expect(truncated).toBe(`${'a'.repeat(PROVIDER_MESSAGE_MAX_LENGTH - 2)}…`);
    expect(truncated).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});
