import { describe, expect, it } from 'vitest';

import { AppFailure } from 'src/utils/app-failure.util';
import { invalidInput } from 'src/utils/invalid-input.util';

describe('invalidInput', () => {
  it('builds an INVALID_INPUT failure with field and reason', () => {
    const failure = invalidInput('name', 'required');

    expect(failure).toBeInstanceOf(AppFailure);
    expect(failure.code).toBe('INVALID_INPUT');
    expect(failure.message).toBe('Campo name: obrigatório.');
    expect(failure.details).toEqual({ field: 'name', reason: 'required' });
  });

  it('locates array items with a zero-based index and a one-based position', () => {
    const failure = invalidInput('signers.email', 'format', 2);

    expect(failure.message).toBe('Campo signers.email (posição 3): formato inválido.');
    expect(failure.details).toEqual({ field: 'signers.email', reason: 'format', index: 2 });
  });

  it.each([
    ['missing', 'ausente'],
    ['too_large', 'grande demais'],
  ])('describes the %s reason', (reason, text) => {
    expect(invalidInput('source.templateId', reason).message).toBe(`Campo source.templateId: ${text}.`);
  });

  it('falls back to the reason code when it has no readable text', () => {
    const failure = invalidInput('source', 'brand_new_reason');

    expect(failure.message).toBe('Campo source: brand_new_reason.');
    expect(failure.details).toEqual({ field: 'source', reason: 'brand_new_reason' });
  });

  it('names the field by its form label, keeping the key in details', () => {
    const failure = invalidInput('signers.email', 'required', 0, 'E-mail do signatário');

    expect(failure.message).toBe('Campo "E-mail do signatário" (posição 1): obrigatório.');
    expect(failure.details).toEqual({ field: 'signers.email', reason: 'required', index: 0 });
  });
});
