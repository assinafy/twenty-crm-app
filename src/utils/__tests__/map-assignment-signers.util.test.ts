import { type IAssignment, type IAssignmentSigner, type INotificationHistoryEntry } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { buildStoredSigner } from 'src/__tests__/fixtures/build-stored-signer';
import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { type StoredSigner } from 'src/types/stored-signer';
import { mapAssignmentSigners } from 'src/utils/map-assignment-signers.util';

const SIGNING_URL = LEAK_SENTINELS[3];

const signer = (overrides: Partial<IAssignmentSigner> = {}): IAssignmentSigner => ({
  id: 'signer-1',
  full_name: 'Ana Souza',
  email: 'ana@example.invalid',
  whatsapp_phone_number: '+5511999990000',
  verification_method: 'Whatsapp',
  notification_methods: ['Whatsapp'],
  step: 1,
  notified: true,
  completed: false,
  notification_history: [],
  ...overrides,
});

const assignment = (signers: IAssignmentSigner[]): IAssignment => ({
  id: 'assignment-1',
  method: 'virtual',
  signers,
  signing_urls: [{ signer_id: 'signer-1', url: SIGNING_URL }],
});

const stored = (overrides: Partial<StoredSigner> = {}): StoredSigner =>
  buildStoredSigner({ completed: true, ...overrides });

const history = (status: 'sent' | 'failed', at: string | null): INotificationHistoryEntry => ({
  event: 'notification',
  status,
  error_code: null,
  error_message: null,
  sent_at: status === 'sent' ? at : null,
  failed_at: status === 'failed' ? at : null,
});

describe('mapAssignmentSigners', () => {
  it('maps signers without signing URLs', () => {
    const result = mapAssignmentSigners(assignment([signer()]), null);
    expect(result).toEqual([
      {
        id: 'signer-1',
        name: 'Ana Souza',
        email: 'ana@example.invalid',
        phone: '+5511999990000',
        verificationMethod: 'Whatsapp',
        notificationMethod: 'Whatsapp',
        step: 1,
        notified: true,
        completed: false,
        deliveryFailed: false,
        declined: false,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(SIGNING_URL);
  });

  it('returns the previous signers when there is no assignment', () => {
    const previous = [stored()];
    expect(mapAssignmentSigners(null, previous)).toBe(previous);
    expect(mapAssignmentSigners(undefined, null)).toEqual([]);
  });

  it('keeps the previous completed value when Assinafy omits it (tri-state)', () => {
    const { completed: _completed, ...withoutCompleted } = signer();
    const result = mapAssignmentSigners(
      assignment([withoutCompleted, signer({ id: 'signer-2', completed: null }), signer({ id: 'signer-3' })]),
      [stored(), stored({ id: 'signer-2', completed: false }), stored({ id: 'signer-3', completed: true })],
    );
    expect(result.map((item) => item.completed)).toEqual([true, false, false]);
  });

  it('leaves completed unknown without a previous value', () => {
    const { completed: _completed, ...withoutCompleted } = signer();
    expect(mapAssignmentSigners(assignment([withoutCompleted]), [stored({ id: 'other' })])[0]?.completed).toBeNull();
  });

  it('flags a failed delivery from the newest history entry', () => {
    const result = mapAssignmentSigners(
      assignment([
        signer({ notification_history: [history('failed', '2026-09-02T10:00:00Z'), history('sent', '2026-09-01T10:00:00Z')] }),
        signer({ id: 'signer-2', notification_history: [history('failed', '2026-09-01T10:00:00Z'), history('sent', '2026-09-02T10:00:00Z')] }),
        signer({ id: 'signer-3', notification_history: [history('sent', null), history('failed', null)] }),
        signer({ id: 'signer-4', notification_history: null }),
      ]),
      null,
    );
    expect(result.map((item) => item.deliveryFailed)).toEqual([true, false, true, false]);
  });

  it('keeps the WhatsApp number only for a signer invited by WhatsApp', () => {
    const { whatsapp_phone_number: _phone, ...withoutPhone } = signer();
    const result = mapAssignmentSigners(
      assignment([
        signer({ verification_method: 'Email', notification_methods: ['Email'] }),
        signer({ id: 'signer-2', verification_method: 'DigitalCertificate', notification_methods: ['Email'] }),
        { ...withoutPhone, id: 'signer-3' },
      ]),
      null,
    );
    expect(result.map((item) => item.phone)).toEqual([null, null, null]);
  });

  it('nulls unknown or missing channel values', () => {
    const { notification_history: _history, whatsapp_phone_number: _phone, ...bare } = signer({
      email: null,
      verification_method: 'Sms',
      notification_methods: null,
      step: null,
      notified: null,
    });
    expect(mapAssignmentSigners(assignment([bare]), null)).toEqual([
      {
        id: 'signer-1',
        name: 'Ana Souza',
        email: null,
        phone: null,
        verificationMethod: null,
        notificationMethod: null,
        step: null,
        notified: null,
        completed: false,
        deliveryFailed: false,
        declined: false,
      },
    ]);
  });

  it('marks only the signer who declined when Assinafy names one', () => {
    const result = mapAssignmentSigners(
      assignment([signer(), signer({ id: 'signer-2' })]),
      [stored({ declined: true }), stored({ id: 'signer-2' })],
      'signer-2',
    );
    expect(result.map((item) => item.declined)).toEqual([false, true]);
    expect(mapAssignmentSigners(assignment([signer()]), [stored({ declined: true })], null)[0]?.declined).toBe(false);
  });

  it('keeps the previous declined value when who declined is unknown', () => {
    const result = mapAssignmentSigners(assignment([signer(), signer({ id: 'signer-2' })]), [stored({ declined: true })]);
    expect(result.map((item) => item.declined)).toEqual([true, false]);
  });

  it('tolerates an assignment without signers', () => {
    const { signers: _signers, ...withoutSigners } = assignment([]);
    expect(mapAssignmentSigners(withoutSigners as IAssignment, null)).toEqual([]);
  });
});
