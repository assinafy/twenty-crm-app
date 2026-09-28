import { describe, expect, it } from 'vitest';

import { getStatusHints } from 'src/front-components/utils/get-status-hints.util';

const hints = (overrides: Partial<Parameters<typeof getStatusHints>[0]>) =>
  getStatusHints({
    status: 'PENDING_SIGNATURE',
    lastError: null,
    declineReason: null,
    assinafyDocumentId: 'doc-1',
    ...overrides,
  }).map(({ message, values }) => [message.message, values]);

describe('getStatusHints', () => {
  it('has nothing to add for a healthy pending document', () => {
    expect(hints({})).toEqual([]);
  });

  it('explains sending and uncertain documents', () => {
    expect(hints({ status: 'SENDING' })).toEqual([['Enviando para a Assinafy. Atualize em instantes.', undefined]]);
    expect(hints({ status: 'UNCERTAIN' })[0]?.[0]).toBe(
      'A Assinafy pode ter recebido esta solicitação. Atualize para conferir.',
    );
    expect(hints({ status: 'UNCERTAIN', assinafyDocumentId: null })[0]?.[0]).toMatch(/remova-o do Twenty/);
  });

  it('explains a failed send with its reason', () => {
    expect(hints({ status: 'FAILED', lastError: 'PROVIDER_UNAVAILABLE' })).toEqual([
      ['Esta solicitação não chegou aos signatários. Remova-a e envie novamente.', undefined],
      ['A Assinafy está indisponível no momento. Tente novamente em alguns minutos.', undefined],
    ]);
    expect(hints({ status: 'FAILED', lastError: 'NOT_SENT' })).toHaveLength(1);
    expect(hints({ status: 'FAILED' })).toHaveLength(1);
  });

  it('quotes the decline reason', () => {
    expect(hints({ status: 'REJECTED_BY_SIGNER', declineReason: 'Valor errado' })).toEqual([
      ['Motivo informado: {reason}', { reason: 'Valor errado' }],
    ]);
    expect(hints({ status: 'REJECTED_BY_SIGNER' })).toEqual([]);
  });

  it('explains expired, deleted and cancelled documents', () => {
    expect(hints({ status: 'EXPIRED' })[0]?.[0]).toMatch(/prazo para assinar terminou/);
    expect(hints({ status: 'CANCELLED', lastError: 'NOT_FOUND' })).toEqual([
      ['Este documento foi excluído na Assinafy.', undefined],
    ]);
    expect(hints({ status: 'CANCELLED' })).toEqual([]);
  });

  it('explains pending signed files and a failed refresh', () => {
    expect(hints({ status: 'CERTIFICATING', lastError: 'SIGNED_FILES_PENDING' })[0]?.[0]).toMatch(/ainda está sendo copiado/);
    expect(hints({ lastError: 'RECONNECT_REQUIRED' })[0]?.[0]).toMatch(/Reconecte a Assinafy/);
  });

  it('explains a document the background sync cannot reach', () => {
    expect(hints({ lastError: 'NO_CREDENTIAL' })).toEqual([
      [
        'As atualizações automáticas não alcançam o workspace da Assinafy deste documento. Peça a um administrador para compartilhar uma conexão com esse workspace ou configurar uma chave de API com acesso a ele.',
        undefined,
      ],
    ]);
    expect(hints({ status: 'CERTIFICATING', lastError: 'NO_CREDENTIAL' })).toHaveLength(1);
  });
});
