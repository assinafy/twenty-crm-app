import { describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { buildStoredSigner } from 'src/__tests__/fixtures/build-stored-signer';
import { getDocumentStatusHandler } from 'src/logic-functions/handlers/get-document-status.handler';
import { DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { refreshDocumentHandler } from 'src/logic-functions/handlers/refresh-document.handler';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

vi.mock('src/logic-functions/handlers/refresh-document.handler', () => ({ refreshDocumentHandler: vi.fn<typeof refreshDocumentHandler>() }));

const refresh = vi.mocked(refreshDocumentHandler);
const input = { documentRecordId: DOCUMENT_RECORD_ID };
// The logic function has already required a signed-in member.
const memberContext = () => buildContext() as MemberHandlerContext;
const summary = (status: 'CERTIFICATED' | 'PENDING_SIGNATURE', signers: Parameters<typeof buildStoredSigner>[0][]) =>
  toDocumentSummary(buildDocumentRecord({ status, signers: signers.map((signer) => buildStoredSigner(signer)) }));

describe('getDocumentStatusHandler', () => {
  it('refreshes the document and describes its progress in Portuguese', async () => {
    const document = toDocumentSummary(
      buildDocumentRecord({
        signerCount: 4,
        signedCount: 1,
        signers: [
          buildStoredSigner({ id: 's-1', name: 'Ana', completed: true }),
          buildStoredSigner({ id: 's-2', name: 'Bruno', notified: true, completed: null }),
          buildStoredSigner({ id: 's-3', name: 'Carla', notified: false }),
          buildStoredSigner({ id: 's-4', name: 'Davi', deliveryFailed: true }),
        ],
        expiresAt: '2026-10-01T00:00:00.000Z',
        lastSyncedAt: '2026-09-25T12:00:00.000Z',
      }),
    );
    refresh.mockResolvedValue(document);
    const ctx = memberContext();

    await expect(getDocumentStatusHandler(input, ctx)).resolves.toEqual({
      document,
      text:
        'O documento "Service agreement" está aguardando assinaturas. Assinaturas: 1 de 4. Signatários: ' +
        'Ana (assinou), Bruno (convidado, ainda não assinou), Carla (ainda não convidado), Davi (falha na entrega). ' +
        'Enviado em 20 de set. de 2026, 09:00 (horário de Brasília). ' +
        'Prazo para assinar: 30 de set. de 2026, 21:00 (horário de Brasília). ' +
        'Última verificação: 25 de set. de 2026, 09:00 (horário de Brasília).',
    });
    expect(refresh).toHaveBeenCalledWith(input, ctx);
  });

  it('names the declining signer, the reason and the completion date', async () => {
    refresh.mockResolvedValue(
      toDocumentSummary(
        buildDocumentRecord({
          status: 'REJECTED_BY_SIGNER',
          signers: [buildStoredSigner({ declined: true })],
          declineReason: 'Valor errado',
          completedAt: '2026-09-22T00:00:00.000Z',
        }),
      ),
    );

    const { text } = await getDocumentStatusHandler(input, memberContext());

    expect(text).toBe(
      'O documento "Service agreement" foi recusado por um signatário. Assinaturas: 0 de 1. ' +
        'Signatários: Ana Souza (recusou). Motivo da recusa: "Valor errado". ' +
        'Enviado em 20 de set. de 2026, 09:00 (horário de Brasília). ' +
        'Concluído em 21 de set. de 2026, 21:00 (horário de Brasília).',
    );
  });

  it('describes signers the way the document panel shows them', async () => {
    refresh.mockResolvedValueOnce(summary('CERTIFICATED', [{ name: 'Bruno', completed: null, notified: null }]));
    await expect(getDocumentStatusHandler(input, memberContext())).resolves.toMatchObject({
      text: expect.stringContaining('Signatários: Bruno (assinou).'),
    });

    refresh.mockResolvedValueOnce(
      summary('PENDING_SIGNATURE', [
        { name: 'Ana', notified: null, completed: null },
        { name: 'Carla', notified: false, step: 2 },
      ]),
    );
    await expect(getDocumentStatusHandler(input, memberContext())).resolves.toMatchObject({
      text: expect.stringContaining('Signatários: Ana (convidado, ainda não assinou), Carla (aguardando signatários anteriores).'),
    });
  });

  it('describes an unnamed document without signers and with an error code', async () => {
    refresh.mockResolvedValue(
      toDocumentSummary(
        buildDocumentRecord({ name: null, status: 'FAILED', signers: null, sentAt: null, lastError: 'COST_CHANGED' }),
      ),
    );

    const { text } = await getDocumentStatusHandler(input, memberContext());

    expect(text).toBe(
      'O documento sem nome não pôde ser enviado. Assinaturas: 0 de 1. Código do último erro: COST_CHANGED.',
    );
  });

  it('explains a status the app does not recognize', async () => {
    refresh.mockResolvedValue(toDocumentSummary(buildDocumentRecord({ status: 'UNKNOWN', signers: null, sentAt: null })));

    const { text } = await getDocumentStatusHandler(input, memberContext());

    expect(text).toBe(
      'O documento "Service agreement" está com um status que o app não reconhece; confira na Assinafy. ' +
        'Assinaturas: 0 de 1.',
    );
  });

  it('leaves out a date that cannot be read', async () => {
    refresh.mockResolvedValue(
      toDocumentSummary(buildDocumentRecord({ signers: null, sentAt: 'not a date' })),
    );

    const { text } = await getDocumentStatusHandler(input, memberContext());

    expect(text).toBe('O documento "Service agreement" está aguardando assinaturas. Assinaturas: 0 de 1.');
  });

  it('propagates refresh failures', async () => {
    refresh.mockRejectedValue(new AppFailure('NOT_CONNECTED', 'Connect Assinafy'));

    await expect(getDocumentStatusHandler(input, memberContext())).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });
});
