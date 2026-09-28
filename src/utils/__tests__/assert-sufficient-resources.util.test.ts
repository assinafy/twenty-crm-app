import { describe, expect, it } from 'vitest';

import { buildCostEstimate } from 'src/__tests__/fixtures/build-cost-estimate';
import { assertSufficientResources } from 'src/utils/assert-sufficient-resources.util';

const estimate = buildCostEstimate({
  documents: 1,
  totalCredits: 0,
  creditBalance: 0,
  documentBalance: 0,
  needsExtraDocument: true,
  extraDocumentCost: 1,
});

describe('assertSufficientResources', () => {
  it('passes a sufficient estimate', () => {
    expect(() => assertSufficientResources(estimate)).not.toThrow();
  });

  it('throws INSUFFICIENT_RESOURCES with the blocking reason and estimate', () => {
    const insufficient = { ...estimate, sufficient: false, blockingReason: 'InsufficientDocuments' as const };
    expect(() => assertSufficientResources(insufficient)).toThrow(
      expect.objectContaining({
        code: 'INSUFFICIENT_RESOURCES',
        message: 'O workspace da Assinafy não tem documentos ou créditos suficientes.',
        details: { blockingReason: 'InsufficientDocuments', estimate: insufficient },
      }),
    );
  });
});
