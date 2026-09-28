import { type ICostEstimate, type ILegacyResendCostEstimate } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { AppFailure } from 'src/utils/app-failure.util';
import { normalizeCostEstimate } from 'src/utils/normalize-cost-estimate.util';

const estimate: ICostEstimate = {
  documents: 1,
  credits: 0.9,
  needs_extra_document: true,
  extra_document_cost: 1,
  total_credits: 1.9,
  breakdown: [
    { code: 'ExtraDocument', name: 'Extra document', cost: 1, quantity: 1 },
    { code: 'WhatsappNotification', name: 'WhatsApp', cost: 0.9, quantity: 2, unit_cost: 0.45 },
  ],
  document_balance: 0,
  credit_balance: 10,
  has_sufficient_resources: true,
  blocking_reason: null,
  message: null,
};

describe('normalizeCostEstimate', () => {
  it('normalizes an ICostEstimate', () => {
    expect(normalizeCostEstimate(estimate)).toEqual({
      documents: 1,
      totalCredits: 1.9,
      creditBalance: 10,
      documentBalance: 0,
      needsExtraDocument: true,
      extraDocumentCost: 1,
      sufficient: true,
      blockingReason: null,
    });
  });

  it('keeps a known blocking reason', () => {
    const result = normalizeCostEstimate({
      ...estimate,
      has_sufficient_resources: false,
      blocking_reason: 'PendingPayment',
    });
    expect(result).toMatchObject({ sufficient: false, blockingReason: 'PendingPayment' });
  });

  it('drops an unknown blocking reason', () => {
    const result = normalizeCostEstimate({ ...estimate, has_sufficient_resources: false, blocking_reason: 'Other' });
    expect(result.blockingReason).toBeNull();
  });

  it('defaults missing display-only numbers', () => {
    expect(
      normalizeCostEstimate({
        has_sufficient_resources: true,
        documents: 1,
        total_credits: 0,
      }),
    ).toEqual({
      documents: 1,
      totalCredits: 0,
      creditBalance: null,
      documentBalance: null,
      needsExtraDocument: false,
      extraDocumentCost: 0,
      sufficient: true,
      blockingReason: null,
    });
  });

  it('normalizes the legacy resend shape', () => {
    const legacy: ILegacyResendCostEstimate = {
      total: 0.45,
      breakdown: [{ code: 'WhatsappNotification', name: 'WhatsApp', cost: 0.45 }],
      credit_balance: 3,
      has_sufficient_credits: true,
    };
    expect(normalizeCostEstimate(legacy)).toEqual({
      documents: 0,
      totalCredits: 0.45,
      creditBalance: 3,
      documentBalance: null,
      needsExtraDocument: false,
      extraDocumentCost: 0,
      sufficient: true,
      blockingReason: null,
    });
  });

  it('reports insufficient credits for the legacy shape', () => {
    const result = normalizeCostEstimate({ has_sufficient_credits: false, total: 0 });
    expect(result).toMatchObject({
      sufficient: false,
      blockingReason: 'InsufficientCredits',
      totalCredits: 0,
      creditBalance: null,
    });
  });

  it.each([
    null,
    undefined,
    'estimate',
    42,
    [],
    {},
    { total_credits: 1 },
    { has_sufficient_resources: 'yes' },
    { ...estimate, total_credits: undefined },
    { ...estimate, total_credits: Number.NaN },
    { ...estimate, total_credits: '1.90' },
    { ...estimate, documents: undefined },
    { ...estimate, documents: Number.POSITIVE_INFINITY },
    { has_sufficient_credits: true },
    { has_sufficient_credits: true, total: '0.45' },
  ])(
    'rejects an unexpected shape (%o)',
    (raw) => {
      expect(() => normalizeCostEstimate(raw)).toThrow(AppFailure);
      expect(() => normalizeCostEstimate(raw)).toThrow(expect.objectContaining({ code: 'INTERNAL' }));
    },
  );
});
