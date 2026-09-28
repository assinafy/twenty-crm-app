import { describe, expect, it } from 'vitest';

import { buildStoredSigner } from 'src/__tests__/fixtures/build-stored-signer';
import { getSignerStatus } from 'src/front-components/utils/get-signer-status.util';
import { type StoredSigner } from 'src/types/stored-signer';

const signer = (overrides: Partial<StoredSigner> = {}): StoredSigner =>
  buildStoredSigner({ name: 'Ana', email: null, step: 1, ...overrides });
type SignerDocument = Parameters<typeof getSignerStatus>[1];

const pending: SignerDocument = { status: 'PENDING_SIGNATURE' };
const label = (value: StoredSigner, document: SignerDocument = pending) =>
  getSignerStatus(value, document).label.message;

describe('getSignerStatus', () => {
  it('derives each signer state', () => {
    expect(label(signer({ completed: true }))).toBe('Assinou');
    expect(label(signer({ declined: true }), { status: 'REJECTED_BY_SIGNER' })).toBe('Recusou');
    expect(label(signer({ deliveryFailed: true }))).toBe('Falha na entrega');
    expect(label(signer({ notified: false, step: 2 }))).toBe('Aguardando signatários anteriores');
    expect(label(signer())).toBe('Convidado');
    expect(label(signer({ notified: null }))).toBe('Convidado');
  });

  it('shows a signer not yet invited as pending when no earlier step exists', () => {
    expect(getSignerStatus(signer({ notified: false }), pending)).toEqual({
      label: { message: 'Convite pendente' },
      color: 'gray',
    });
    expect(label(signer({ notified: false, step: null }))).toBe('Convite pendente');
  });

  it('shows everyone as signed once Assinafy certifies', () => {
    expect(label(signer({ completed: null }), { status: 'CERTIFICATING' })).toBe('Assinou');
    expect(getSignerStatus(signer(), { status: 'CERTIFICATED' })).toEqual({
      label: { message: 'Assinou', context: 'signer' },
      color: 'green',
    });
  });

  it('does not mark another signer as declined', () => {
    expect(label(signer({ declined: false }), { status: 'REJECTED_BY_SIGNER' })).toBe('Não assinou');
    expect(label(signer({ declined: true }), { status: 'REJECTED_BY_SIGNER' })).toBe('Recusou');
  });

  it('shows who did not sign once the request is cancelled or declined', () => {
    expect(getSignerStatus(signer({ notified: false, step: 2 }), { status: 'CANCELLED' })).toEqual({
      label: { message: 'Não assinou' },
      color: 'gray',
    });
    expect(label(signer({ notified: false }), { status: 'CANCELLED' })).toBe('Não assinou');
    expect(label(signer({ notified: false, step: 2 }), { status: 'REJECTED_BY_SIGNER' })).toBe('Não assinou');
    expect(label(signer({ completed: true }), { status: 'CANCELLED' })).toBe('Assinou');
    expect(label(signer({ deliveryFailed: true }), { status: 'CANCELLED' })).toBe('Falha na entrega');
  });

  it('keeps the invited label when Assinafy did not report whether the signer signed', () => {
    expect(label(signer({ completed: null }), { status: 'REJECTED_BY_SIGNER' })).toBe('Convidado');
  });

  it('keeps the live labels on an expired request, whose deadline Assinafy can extend', () => {
    expect(label(signer({ notified: false, step: 2 }), { status: 'EXPIRED' })).toBe('Aguardando signatários anteriores');
    expect(label(signer(), { status: 'EXPIRED' })).toBe('Convidado');
  });
});
