import { describe, expect, it, vi } from 'vitest';

import { getErrorMessage } from 'src/front-components/utils/get-error-message.util';
import { removeAssinafyDocument } from 'src/front-components/utils/remove-assinafy-document.util';

type Core = Parameters<typeof removeAssinafyDocument>[0];

const core = (mutation: () => Promise<unknown>) => {
  const spy = vi.fn<(request: unknown) => Promise<unknown>>(mutation);

  return Object.assign({ mutation: spy } as unknown as Core, { spy });
};

// Same shape as the client's GenqlError for a Twenty role denial.
const denial = Object.assign(new Error('denied'), {
  errors: [{ message: 'denied', extensions: { code: 'FORBIDDEN', subCode: 'PERMISSION_DENIED' } }],
});

describe('removeAssinafyDocument', () => {
  it('soft deletes the record and reports no error', async () => {
    const client = core(async () => ({}));

    await expect(removeAssinafyDocument(client, 'rec-1')).resolves.toBeNull();
    expect(client.spy).toHaveBeenCalledWith({ deleteAssinafyDocument: { __args: { id: 'rec-1' }, id: true } });
  });

  it('blames the Twenty role when the member may not delete the record', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const failure = await removeAssinafyDocument(
      core(async () => Promise.reject(denial)),
      'rec-1',
    );

    expect(failure).toEqual({ code: 'FORBIDDEN', message: '', details: { reason: 'member_permission' } });
    expect(getErrorMessage(failure ?? { code: '' }).message.message).toBe(
      'Sua função no Twenty não permite alterar este documento.',
    );
  });

  it.each([
    new TypeError('fetch failed'),
    'boom',
    Object.assign(new Error('mixed'), {
      errors: [{ extensions: { code: 'FORBIDDEN' } }, { extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
    }),
  ])('reports any other failure as INTERNAL (%s)', async (thrown) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(removeAssinafyDocument(core(async () => Promise.reject(thrown)), 'rec-1')).resolves.toEqual({
      code: 'INTERNAL',
      message: '',
    });
    expect(log).toHaveBeenCalledWith('[assinafy] removing the document failed', {
      name: thrown instanceof Error ? thrown.name : typeof thrown,
    });
  });
});
