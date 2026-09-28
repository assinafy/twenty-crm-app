import { ApiError, NetworkError } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import {
  costEstimate,
  fakeAssinafyClient,
  pdfInput,
  resolvedCredential,
  templateInput,
} from 'src/services/__tests__/service-fixtures';
import { estimateSignatureRequest } from 'src/services/estimate-signature-request.service';

describe('estimateSignatureRequest', () => {
  it('estimates a virtual assignment on the uploaded PDF from each signer channel', async () => {
    const fake = fakeAssinafyClient();
    fake.assignments.estimateCost.mockResolvedValue(costEstimate({ total_credits: 0.45, credits: 0.45 }));
    const whatsapp = buildSignerInput({ phone: '+5511999990000', verificationMethod: 'Whatsapp', notificationMethod: 'Whatsapp' });

    const estimate = await estimateSignatureRequest(
      resolvedCredential(fake.client),
      pdfInput({ signers: [buildSignerInput(), whatsapp] }),
      'doc-1',
    );

    expect(estimate).toMatchObject({ documents: 1, totalCredits: 0.45, sufficient: true });
    expect(fake.assignments.estimateCost).toHaveBeenCalledExactlyOnceWith('doc-1', {
      method: 'virtual',
      signers: [
        { verification_method: 'Email', notification_methods: ['Email'] },
        { verification_method: 'Whatsapp', notification_methods: ['Whatsapp'] },
      ],
    });
  });

  it('needs the uploaded document for a PDF', async () => {
    const fake = fakeAssinafyClient();

    await expect(estimateSignatureRequest(resolvedCredential(fake.client), pdfInput(), null)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    expect(fake.assignments.estimateCost).not.toHaveBeenCalled();
  });

  it('estimates one entry per template signer role without listing templates', async () => {
    const fake = fakeAssinafyClient();
    fake.documents.estimateCostFromTemplate.mockResolvedValue(costEstimate({ documents: 0, total_credits: 1 }));

    await expect(estimateSignatureRequest(resolvedCredential(fake.client), templateInput(), null)).resolves.toMatchObject({
      documents: 0,
      totalCredits: 1,
    });
    expect(fake.documents.estimateCostFromTemplate).toHaveBeenCalledExactlyOnceWith('template-1', [
      { role_id: 'role-client', verification_method: 'Email', notification_methods: ['Email'] },
    ]);
    expect(fake.templates.list).not.toHaveBeenCalled();
  });

  it('refuses a template signer without a role', async () => {
    const fake = fakeAssinafyClient();

    await expect(
      estimateSignatureRequest(resolvedCredential(fake.client), templateInput({ signers: [buildSignerInput()] }), null),
    ).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(fake.documents.estimateCostFromTemplate).not.toHaveBeenCalled();
  });

  it.each([
    [new NetworkError('timeout'), 'PROVIDER_UNAVAILABLE'],
    [new ApiError('Server error', 500), 'PROVIDER_UNAVAILABLE'],
    [new ApiError('Conflict', 409), 'PROVIDER_REJECTED'],
  ])('maps an estimate failure as a read, never as UNCERTAIN: %o', async (error, code) => {
    const fake = fakeAssinafyClient();
    fake.assignments.estimateCost.mockRejectedValue(error);

    await expect(estimateSignatureRequest(resolvedCredential(fake.client), pdfInput(), 'doc-1')).rejects.toMatchObject({
      code,
    });
  });

  it('rejects an estimate without a sufficiency flag', async () => {
    const fake = fakeAssinafyClient();
    fake.assignments.estimateCost.mockResolvedValue({} as ReturnType<typeof costEstimate>);

    await expect(estimateSignatureRequest(resolvedCredential(fake.client), pdfInput(), 'doc-1')).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });
});
