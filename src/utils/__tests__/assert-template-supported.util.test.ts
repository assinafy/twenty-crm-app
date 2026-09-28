import { describe, expect, it } from 'vitest';

import { assertTemplateSupported } from 'src/utils/assert-template-supported.util';

describe('assertTemplateSupported', () => {
  it('accepts a supported template', () => {
    expect(() => assertTemplateSupported({ unsupportedReason: null }, 'templateId')).not.toThrow();
  });

  it('reports a template that is too large', () => {
    expect(() => assertTemplateSupported({ unsupportedReason: 'TOO_LARGE' }, 'templateId')).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT', details: { field: 'templateId', reason: 'too_large' } }),
    );
  });

  it('reports any other reason as unsupported', () => {
    expect(() => assertTemplateSupported({ unsupportedReason: 'UNSUPPORTED_ROLES' }, 'source.templateId')).toThrow(
      expect.objectContaining({ details: { field: 'source.templateId', reason: 'unsupported' } }),
    );
  });
});
