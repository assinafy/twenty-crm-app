import { ApiError } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { fakeAssinafyClient, templateItem } from 'src/services/__tests__/service-fixtures';
import { findSignatureTemplate } from 'src/services/find-signature-template.service';
import { type SignatureSource } from 'src/types/signature-source';

type TemplateSource = Extract<SignatureSource, { type: 'TEMPLATE' }>;

const source = (overrides: Partial<TemplateSource> = {}): TemplateSource => ({
  type: 'TEMPLATE',
  templateId: 'template-1',
  editorFields: [{ fieldId: 'field-price', value: '100' }],
  ...overrides,
});
const client = buildSignerInput({ roleId: 'role-client' });
const others = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => templateItem({ id: `${prefix}-${index}` }));

const find = async (
  pages: Array<ReturnType<typeof templateItem>[]>,
  templateSource = source(),
  signers = [client],
) => {
  const fake = fakeAssinafyClient();
  for (const data of pages) fake.templates.list.mockResolvedValueOnce({ data });
  return { result: findSignatureTemplate(fake.client, templateSource, signers), list: fake.templates.list };
};

describe('findSignatureTemplate', () => {
  it('returns the summary of a matching ready template', async () => {
    const { result, list } = await find([[templateItem()]]);

    await expect(result).resolves.toMatchObject({
      id: 'template-1',
      name: 'Sales contract',
      signerRoles: [{ id: 'role-client', name: 'Client' }],
      editorFields: [{ fieldId: 'field-price', label: 'Price' }],
    });
    expect(list).toHaveBeenCalledExactlyOnceWith({ page: 1, per_page: 50 });
  });

  it('pages through templates 50 at a time', async () => {
    const { result, list } = await find([others(50, 'a'), others(50, 'b'), [templateItem()]]);

    await expect(result).resolves.toMatchObject({ id: 'template-1' });
    expect(list.mock.calls.map(([params]) => params)).toEqual([
      { page: 1, per_page: 50 },
      { page: 2, per_page: 50 },
      { page: 3, per_page: 50 },
    ]);
  });

  it('stops after four pages', async () => {
    const { result, list } = await find([others(50, 'a'), others(50, 'b'), others(50, 'c'), others(50, 'd')]);

    await expect(result).rejects.toMatchObject({ details: { field: 'source.templateId', reason: 'not_found' } });
    expect(list).toHaveBeenCalledTimes(4);
  });

  it('stops at a short page', async () => {
    const { result, list } = await find([others(3, 'a')]);

    await expect(result).rejects.toMatchObject({ code: 'INVALID_INPUT', details: { reason: 'not_found' } });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('treats a template that is not ready as missing', async () => {
    const { result } = await find([[templateItem({ status: 'Processing' })]]);

    await expect(result).rejects.toMatchObject({ details: { field: 'source.templateId', reason: 'not_found' } });
  });

  it('rejects a template with unsupported roles', async () => {
    const roles = [...(templateItem().roles ?? []), { id: 'role-copy', name: 'Copy', assignment_type: 'CopyReceiver' }];
    const { result } = await find([[templateItem({ roles })]]);

    await expect(result).rejects.toMatchObject({ details: { field: 'source.templateId', reason: 'unsupported' } });
  });

  it('rejects a template with more signer roles than a request accepts', async () => {
    const roles = Array.from({ length: 21 }, (_, index) => ({ id: `role-${index}`, name: `R${index}`, assignment_type: 'Signer' }));
    const { result } = await find([[templateItem({ roles })]]);

    await expect(result).rejects.toMatchObject({ details: { field: 'source.templateId', reason: 'too_large' } });
  });

  it.each([
    ['a missing role', []],
    ['an unknown role', [buildSignerInput({ roleId: 'role-other' })]],
    ['a role filled twice', [client, buildSignerInput({ email: 'b@example.invalid', roleId: 'role-client' })]],
    ['a signer without a role', [buildSignerInput()]],
  ])('rejects %s', async (_label, signers) => {
    const { result } = await find([[templateItem()]], source(), signers);

    await expect(result).rejects.toMatchObject({ details: { field: 'signers.roleId', reason: 'mismatch' } });
  });

  it('rejects an editor field the template does not have', async () => {
    const { result } = await find(
      [[templateItem()]],
      source({ editorFields: [{ fieldId: 'field-price', value: '1' }, { fieldId: 'field-x', value: '2' }] }),
    );

    await expect(result).rejects.toMatchObject({
      details: { field: 'source.editorFields.fieldId', reason: 'unknown' },
    });
  });

  it('rejects a repeated editor field', async () => {
    const { result } = await find(
      [[templateItem()]],
      source({ editorFields: [{ fieldId: 'field-price', value: '100' }, { fieldId: 'field-price', value: '999' }] }),
    );

    await expect(result).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { field: 'source.editorFields.fieldId', reason: 'duplicate' },
    });
  });

  it('reports an editor field the draft lacks as missing (the template changed)', async () => {
    const { result } = await find([[templateItem()]], source({ editorFields: [] }));

    await expect(result).rejects.toMatchObject({
      details: { field: 'source.editorFields.value', reason: 'missing' },
    });
  });

  it('maps a listing failure as a read', async () => {
    const fake = fakeAssinafyClient();
    fake.templates.list.mockRejectedValue(new ApiError('Server error', 503));

    await expect(findSignatureTemplate(fake.client, source(), [client])).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });
});
