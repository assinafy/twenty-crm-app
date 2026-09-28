import { describe, expect, it } from 'vitest';

import { validateSigners } from 'src/utils/validate-signers.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });

const emailSigner = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ana Test',
  email: 'ana@example.invalid',
  verificationMethod: 'Email',
  ...overrides,
});
const whatsappSigner = (overrides: Record<string, unknown> = {}) => ({
  name: 'Bia Test',
  phone: '+1 (555) 010-0001',
  verificationMethod: 'Whatsapp',
  ...overrides,
});
const certificateSigner = (overrides: Record<string, unknown> = {}) => ({
  name: 'Caio Test',
  email: 'caio@example.invalid',
  verificationMethod: 'DigitalCertificate',
  governmentId: '000.000.001-91',
  ...overrides,
});
const manySigners = (count: number) =>
  Array.from({ length: count }, (_, index) => emailSigner({ email: `signer${index}@example.invalid` }));
const pdf = { source: 'PDF' } as const;
const template = { source: 'TEMPLATE' } as const;

describe('validateSigners', () => {
  it('returns normalized Email signers', () => {
    expect(validateSigners([emailSigner({ name: '  Ana Test  ', email: ' ana@example.invalid ' })], pdf)).toEqual([
      {
        name: 'Ana Test',
        email: 'ana@example.invalid',
        phone: null,
        verificationMethod: 'Email',
        notificationMethod: 'Email',
        governmentId: null,
        roleId: null,
      },
    ]);
  });

  it('returns normalized WhatsApp signers', () => {
    expect(validateSigners([whatsappSigner({ notificationMethod: 'Whatsapp' })], pdf)).toEqual([
      expect.objectContaining({ phone: '+15550100001', email: null, notificationMethod: 'Whatsapp' }),
    ]);
  });

  describe('count', () => {
    it('accepts 1 and 20 signers', () => {
      expect(validateSigners(manySigners(1), pdf)).toHaveLength(1);
      expect(validateSigners(manySigners(20), pdf)).toHaveLength(20);
    });

    it('rejects 0, 21, a missing list and a non-list', () => {
      expect(() => validateSigners([], pdf)).toThrow(invalid({ field: 'signers', reason: 'too_few' }));
      expect(() => validateSigners(manySigners(21), pdf)).toThrow(invalid({ field: 'signers', reason: 'too_many' }));
      expect(() => validateSigners(undefined, pdf)).toThrow(invalid({ field: 'signers', reason: 'required' }));
      expect(() => validateSigners(emailSigner(), pdf)).toThrow(invalid({ field: 'signers', reason: 'type' }));
    });
  });

  describe('shape', () => {
    it('rejects non-object items with their index', () => {
      expect(() => validateSigners([emailSigner(), 'ana@example.invalid'], pdf)).toThrow(
        invalid({ field: 'signers', reason: 'type', index: 1 }),
      );
    });

    it('rejects unknown keys', () => {
      expect(() => validateSigners([emailSigner({ cpf: '00000000191' })], pdf)).toThrow(
        invalid({ field: 'signers.cpf', reason: 'unknown_key', index: 0 }),
      );
    });
  });

  describe('name', () => {
    it('accepts 200 characters', () => {
      expect(validateSigners([emailSigner({ name: 'n'.repeat(200) })], pdf)[0]?.name).toHaveLength(200);
    });

    it.each([
      ['n'.repeat(201), 'too_long'],
      ['   ', 'required'],
      [undefined, 'required'],
      [42, 'type'],
    ])('rejects %j (%s)', (name, reason) => {
      expect(() => validateSigners([emailSigner({ name })], pdf)).toThrow(
        invalid({ field: 'signers.name', reason, index: 0 }),
      );
    });
  });

  describe('methods', () => {
    it('requires a known verification method', () => {
      expect(() => validateSigners([emailSigner({ verificationMethod: undefined })], pdf)).toThrow(
        invalid({ field: 'signers.verificationMethod', reason: 'required', index: 0 }),
      );
      expect(() => validateSigners([emailSigner({ verificationMethod: 'Sms' })], pdf)).toThrow(
        invalid({ field: 'signers.verificationMethod', reason: 'format', index: 0 }),
      );
    });

    it.each([
      [emailSigner({ notificationMethod: 'Whatsapp', phone: '+15550100001' })],
      [whatsappSigner({ notificationMethod: 'Email', email: 'bia@example.invalid' })],
    ])('rejects a channel that does not match the verification method', (signer) => {
      expect(() => validateSigners([signer], pdf)).toThrow(
        invalid({ field: 'signers.notificationMethod', reason: 'mismatch', index: 0 }),
      );
    });

    it('rejects an unknown channel', () => {
      expect(() => validateSigners([emailSigner({ notificationMethod: 'Sms' })], pdf)).toThrow(
        invalid({ field: 'signers.notificationMethod', reason: 'format', index: 0 }),
      );
    });
  });

  describe('contacts', () => {
    it('requires the contact of the notification channel', () => {
      expect(() => validateSigners([emailSigner({ email: undefined, phone: '+15550100001' })], pdf)).toThrow(
        invalid({ field: 'signers.email', reason: 'required', index: 0 }),
      );
      expect(() => validateSigners([whatsappSigner({ phone: '', email: 'bia@example.invalid' })], pdf)).toThrow(
        invalid({ field: 'signers.phone', reason: 'required', index: 0 }),
      );
    });

    it('validates the channel contact', () => {
      expect(() => validateSigners([emailSigner({ email: 'ana@example' })], pdf)).toThrow(
        invalid({ field: 'signers.email', reason: 'format', index: 0 }),
      );
      expect(() => validateSigners([whatsappSigner({ phone: '+0 555 010 0001' })], pdf)).toThrow(
        invalid({ field: 'signers.phone', reason: 'format', index: 0 }),
      );
    });

    it('validates and keeps the optional other contact', () => {
      expect(validateSigners([emailSigner({ phone: '+1 555 010 0002' })], pdf)[0]?.phone).toBe('+15550100002');
      expect(validateSigners([whatsappSigner({ email: 'bia@example.invalid' })], pdf)[0]?.email).toBe(
        'bia@example.invalid',
      );
      expect(() => validateSigners([emailSigner({ phone: '555-0100' })], pdf)).toThrow(
        invalid({ field: 'signers.phone', reason: 'format', index: 0 }),
      );
      expect(() => validateSigners([whatsappSigner({ email: 'not-an-email' })], pdf)).toThrow(
        invalid({ field: 'signers.email', reason: 'format', index: 0 }),
      );
    });
  });

  describe('digital certificate', () => {
    it('defaults to Email notification and keeps the CPF digits', () => {
      expect(validateSigners([certificateSigner()], pdf)[0]).toEqual({
        name: 'Caio Test',
        email: 'caio@example.invalid',
        phone: null,
        verificationMethod: 'DigitalCertificate',
        notificationMethod: 'Email',
        governmentId: '00000000191',
        roleId: null,
      });
    });

    it('accepts WhatsApp notification with a phone and a CNPJ', () => {
      const [signer] = validateSigners(
        [
          certificateSigner({
            email: undefined,
            phone: '+15550100003',
            notificationMethod: 'Whatsapp',
            governmentId: '00.000.000/0001-91',
          }),
        ],
        pdf,
      );

      expect(signer).toEqual(
        expect.objectContaining({ notificationMethod: 'Whatsapp', phone: '+15550100003', governmentId: '00000000000191' }),
      );
    });

    it('requires an 11 or 14 digit government id', () => {
      expect(() => validateSigners([certificateSigner({ governmentId: undefined })], pdf)).toThrow(
        invalid({ field: 'signers.governmentId', reason: 'required', index: 0 }),
      );
      expect(() => validateSigners([certificateSigner({ governmentId: '000000000191' })], pdf)).toThrow(
        invalid({ field: 'signers.governmentId', reason: 'format', index: 0 }),
      );
    });

    it('drops the government id of other verification methods', () => {
      expect(validateSigners([emailSigner({ governmentId: 'anything' })], pdf)[0]?.governmentId).toBeNull();
    });
  });

  describe('roles', () => {
    it('requires a role id for templates, up to 64 characters', () => {
      expect(validateSigners([emailSigner({ roleId: 'r'.repeat(64) })], template)[0]?.roleId).toBe('r'.repeat(64));
      expect(() => validateSigners([emailSigner()], template)).toThrow(
        invalid({ field: 'signers.roleId', reason: 'required', index: 0 }),
      );
      expect(() => validateSigners([emailSigner({ roleId: 'r'.repeat(65) })], template)).toThrow(
        invalid({ field: 'signers.roleId', reason: 'too_long', index: 0 }),
      );
    });

    it('rejects a role id on PDF signers but accepts null', () => {
      expect(validateSigners([emailSigner({ roleId: null })], pdf)[0]?.roleId).toBeNull();
      expect(() => validateSigners([emailSigner({ roleId: 'role-1' })], pdf)).toThrow(
        invalid({ field: 'signers.roleId', reason: 'not_allowed', index: 0 }),
      );
    });

    it('rejects two signers in the same template role', () => {
      const signers = [
        emailSigner({ roleId: 'role-1' }),
        emailSigner({ email: 'other@example.invalid', roleId: 'role-1' }),
      ];

      expect(() => validateSigners(signers, template)).toThrow(
        invalid({ field: 'signers.roleId', reason: 'duplicate', index: 1 }),
      );
    });
  });

  describe('duplicates', () => {
    it('rejects the same email in another case', () => {
      const signers = [emailSigner(), whatsappSigner({ email: 'ANA@Example.Invalid' })];

      expect(() => validateSigners(signers, pdf)).toThrow(
        invalid({ field: 'signers.email', reason: 'duplicate', index: 1 }),
      );
    });

    it('rejects the same WhatsApp number once normalized', () => {
      const signers = [whatsappSigner(), whatsappSigner({ name: 'Other Test', phone: '+15550100001' })];

      expect(() => validateSigners(signers, pdf)).toThrow(
        invalid({ field: 'signers.phone', reason: 'duplicate', index: 1 }),
      );
    });

    it('allows a shared phone on signers not notified by WhatsApp', () => {
      const signers = [
        emailSigner({ phone: '+15550100001' }),
        emailSigner({ email: 'other@example.invalid', phone: '+1 555 010 0001' }),
        whatsappSigner(),
      ];

      expect(validateSigners(signers, pdf)).toHaveLength(3);
    });
  });
});
