import { describe, expect, it } from 'vitest';

import { estimate } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { describeEstimate } from 'src/front-components/utils/describe-estimate.util';

describe('describeEstimate', () => {
  it('describes a plan document and credits', () => {
    const lines = describeEstimate(estimate({ totalCredits: 2.45 }));

    expect(lines.total).toEqual({ message: { message: 'Total em créditos: {credits}' }, values: { credits: '2,45' } });
    expect(lines.documents).toEqual({
      message: { message: 'Documentos do plano usados: {documents}' },
      values: { documents: '1' },
    });
    expect(lines.balance).toEqual({
      message: { message: 'Saldo em créditos: {credits} · Documentos disponíveis no plano: {documents}' },
      values: { credits: '10', documents: '5' },
    });
    expect(lines.blocking).toBeNull();
    expect(lines.confirmation).toEqual({
      message: {
        message: 'Confirmo o custo desta solicitação. Documentos do plano: {documents} · Total em créditos: {credits}.',
      },
      values: { documents: '1', credits: '2,45' },
    });
  });

  it('describes an extra document charged in credits', () => {
    const lines = describeEstimate(estimate({ needsExtraDocument: true, extraDocumentCost: 1, totalCredits: 1.45 }));

    expect(lines.documents).toEqual({
      message: {
        message:
          'Os documentos do plano do workspace da Assinafy acabaram, então esta solicitação usa um documento adicional, incluído no total (custo em créditos: {cost}).',
      },
      values: { cost: '1' },
    });
    expect(lines.confirmation).toEqual({
      message: {
        message: 'Confirmo o custo desta solicitação, que inclui um documento adicional. Total em créditos: {credits}.',
      },
      values: { credits: '1,45' },
    });
  });

  it('shows unknown balances as a dash and omits the line when both are unknown', () => {
    expect(describeEstimate(estimate({ creditBalance: null })).balance?.values).toEqual({
      credits: '—',
      documents: '5',
    });
    expect(describeEstimate(estimate({ documentBalance: null })).balance?.values).toEqual({
      credits: '10',
      documents: '—',
    });
    expect(describeEstimate(estimate({ creditBalance: null, documentBalance: null })).balance).toBeNull();
  });

  it('groups the digits of document counts like credits', () => {
    const lines = describeEstimate(estimate({ documents: 1200, documentBalance: 1500, creditBalance: 1500 }));

    expect(lines.balance?.values).toEqual({ credits: '1.500', documents: '1.500' });
    expect(lines.documents.values).toEqual({ documents: '1.200' });
    expect(lines.confirmation.values).toMatchObject({ documents: '1.200' });
  });

  it('explains what blocks the send', () => {
    expect(
      describeEstimate(estimate({ sufficient: false, blockingReason: 'PendingPayment' })).blocking?.message.message,
    ).toMatch(/pagamento pendente/);
  });
});
