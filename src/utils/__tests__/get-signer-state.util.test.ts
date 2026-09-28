import { describe, expect, it } from 'vitest';

import { buildStoredSigner } from 'src/__tests__/fixtures/build-stored-signer';
import { getSignerState } from 'src/utils/get-signer-state.util';

describe('getSignerState', () => {
  it('reads a signer who completed as signed', () => {
    expect(getSignerState(buildStoredSigner({ completed: true }), 'PENDING_SIGNATURE')).toBe('SIGNED');
  });

  it.each(['CERTIFICATING', 'CERTIFICATED'] as const)('reads every signer of a %s document as signed', (status) => {
    expect(getSignerState(buildStoredSigner({ completed: null, notified: null }), status)).toBe('SIGNED');
  });

  it('reads declined before a delivery failure', () => {
    expect(getSignerState(buildStoredSigner({ declined: true, deliveryFailed: true }), 'REJECTED_BY_SIGNER')).toBe(
      'DECLINED',
    );
  });

  it('reads a delivery failure', () => {
    expect(getSignerState(buildStoredSigner({ deliveryFailed: true }), 'PENDING_SIGNATURE')).toBe('DELIVERY_FAILED');
  });

  it.each([
    ['CANCELLED', { completed: false }],
    ['REJECTED_BY_SIGNER', { completed: null, notified: false }],
  ] as const)('reads a signer of a closed %s request who did not sign as not signed', (status, overrides) => {
    expect(getSignerState(buildStoredSigner(overrides), status)).toBe('NOT_SIGNED');
  });

  it('keeps a closed request signer with unknown completion invited', () => {
    expect(getSignerState(buildStoredSigner({ completed: null, notified: true }), 'CANCELLED')).toBe('INVITED');
  });

  it.each([true, null])('reads notified %o as invited', (notified) => {
    expect(getSignerState(buildStoredSigner({ notified, completed: null }), 'PENDING_SIGNATURE')).toBe('INVITED');
  });

  it('reads a later step not notified yet as waiting', () => {
    expect(getSignerState(buildStoredSigner({ notified: false, step: 2 }), 'PENDING_SIGNATURE')).toBe('WAITING');
  });

  it.each([null, 1])('reads step %o not notified as not invited', (step) => {
    expect(getSignerState(buildStoredSigner({ notified: false, step }), null)).toBe('NOT_INVITED');
  });
});
