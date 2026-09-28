import { ApiError, NetworkError } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { fakeAssinafyClient } from 'src/services/__tests__/service-fixtures';
import { upsertSigners } from 'src/services/upsert-signers.service';

const whatsappSigner = buildSignerInput({
  name: 'Bruno Lima',
  email: null,
  phone: '+5511999990000',
  verificationMethod: 'Whatsapp',
  notificationMethod: 'Whatsapp',
});

describe('upsertSigners', () => {
  it('creates each signer in order and skips the update when nothing differs', async () => {
    const fake = fakeAssinafyClient();
    fake.signers.create
      .mockResolvedValueOnce({ id: 's-1', full_name: 'Ana Souza', email: 'ana@example.invalid' })
      .mockResolvedValueOnce({ id: 's-2', full_name: 'Bruno Lima', email: null, whatsapp_phone_number: '+5511999990000' });

    const result = await upsertSigners(fake.client, [buildSignerInput(), whatsappSigner]);

    expect(result).toEqual([
      { input: buildSignerInput(), assinafySignerId: 's-1' },
      { input: whatsappSigner, assinafySignerId: 's-2' },
    ]);
    expect(fake.signers.create.mock.calls).toEqual([
      [{ full_name: 'Ana Souza', email: 'ana@example.invalid' }],
      [{ full_name: 'Bruno Lima', whatsapp_phone_number: '+5511999990000' }],
    ]);
    expect(fake.signers.update).not.toHaveBeenCalled();
  });

  it('never sends the phone of a signer invited by email', async () => {
    const fake = fakeAssinafyClient();
    fake.signers.create.mockResolvedValue({ id: 's-1', full_name: 'Ana Souza', email: 'ana@example.invalid' });

    await upsertSigners(fake.client, [buildSignerInput({ phone: '+5511999990000' })]);

    expect(fake.signers.create).toHaveBeenCalledWith({ full_name: 'Ana Souza', email: 'ana@example.invalid' });
    expect(fake.signers.update).not.toHaveBeenCalled();
  });

  it('updates a reused signer once with only the differing name and WhatsApp number, never the email', async () => {
    const fake = fakeAssinafyClient();
    fake.signers.create.mockResolvedValue({
      id: 's-2',
      full_name: 'B. Lima',
      email: 'bruno@example.invalid',
      whatsapp_phone_number: '+5511888880000',
    });

    await upsertSigners(fake.client, [{ ...whatsappSigner, email: 'bruno@example.invalid' }]);

    expect(fake.signers.update).toHaveBeenCalledExactlyOnceWith('s-2', {
      full_name: 'Bruno Lima',
      whatsapp_phone_number: '+5511999990000',
    });
  });

  it('always sends the government id of a certificate signer', async () => {
    const fake = fakeAssinafyClient();
    fake.signers.create.mockResolvedValue({ id: 's-1', full_name: 'Ana Souza', email: 'ana@example.invalid' });

    await upsertSigners(fake.client, [
      buildSignerInput({ verificationMethod: 'DigitalCertificate', governmentId: '12345678901' }),
    ]);

    expect(fake.signers.update).toHaveBeenCalledExactlyOnceWith('s-1', { government_id: '12345678901' });
  });

  it.each([
    [new ApiError('Signer rejected', 400), 'PROVIDER_REJECTED'],
    [new NetworkError('socket hang up'), 'PROVIDER_UNAVAILABLE'],
  ])('maps a failure as a (non-billable) mutation: %o', async (error, code) => {
    const fake = fakeAssinafyClient();
    fake.signers.create.mockResolvedValueOnce({ id: 's-1', full_name: 'Ana', email: 'ana@example.invalid' });
    fake.signers.update.mockRejectedValue(error);

    await expect(upsertSigners(fake.client, [buildSignerInput(), whatsappSigner])).rejects.toMatchObject({ code });
    expect(fake.signers.create).toHaveBeenCalledTimes(1);
  });
});
