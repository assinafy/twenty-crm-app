import { describe, expect, it } from 'vitest';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { getStatusDisplay } from 'src/front-components/utils/get-status-display.util';

describe('getStatusDisplay', () => {
  it('labels every status', () => {
    for (const status of Object.values(DOCUMENT_STATUS)) {
      expect(getStatusDisplay(status).label.message).not.toBe('');
    }
  });

  it('uses the pt-BR status names', () => {
    const labels = Object.values(DOCUMENT_STATUS).map((status) => [status, getStatusDisplay(status).label.message]);

    expect(Object.fromEntries(labels)).toEqual({
      SENDING: 'Enviando',
      PENDING_SIGNATURE: 'Aguardando assinaturas',
      CERTIFICATING: 'Finalizando',
      CERTIFICATED: 'Assinado',
      REJECTED_BY_SIGNER: 'Recusado',
      CANCELLED: 'Cancelado',
      EXPIRED: 'Expirado',
      FAILED: 'Falhou',
      UNCERTAIN: 'Confira na Assinafy',
      UNKNOWN: 'Desconhecido',
    });
  });

  it('maps signed, uncertain and missing statuses', () => {
    expect(getStatusDisplay('CERTIFICATED')).toEqual({ label: { message: 'Assinado' }, color: 'green' });
    expect(getStatusDisplay('UNCERTAIN')).toEqual({ label: { message: 'Confira na Assinafy' }, color: 'amber' });
    expect(getStatusDisplay(null)).toEqual({ label: { message: 'Desconhecido' }, color: 'gray' });
  });
});
