import { listConnections } from 'twenty-sdk/logic-function';
import { describe, expect, it, vi } from 'vitest';

import { buildAppConnection } from 'src/assinafy-client/__tests__/build-app-connection';
import { listAssinafyConnections } from 'src/assinafy-client/list-assinafy-connections';

vi.mock('twenty-sdk/logic-function', () => ({ listConnections: vi.fn<typeof listConnections>() }));

const list = vi.mocked(listConnections);

describe('listAssinafyConnections', () => {
  it('scopes the listing to the Assinafy provider', async () => {
    const connection = buildAppConnection();
    list.mockResolvedValue([connection]);

    await expect(listAssinafyConnections({ userWorkspaceId: 'member-1' })).resolves.toEqual([connection]);
    expect(list).toHaveBeenCalledExactlyOnceWith({ providerName: 'assinafy', userWorkspaceId: 'member-1' });
  });

  it('orders connections by name, numbering included, then by id, whatever order Twenty lists them in', async () => {
    const connections = [
      buildAppConnection({ id: 'c', name: 'Assinafy #10' }),
      buildAppConnection({ id: 'b', name: 'Assinafy #2' }),
      buildAppConnection({ id: 'a', name: 'Assinafy #2' }),
    ];

    list.mockResolvedValue([...connections]);
    const first = await listAssinafyConnections({});
    list.mockResolvedValue(connections.toReversed());
    const second = await listAssinafyConnections({});

    expect(first.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(second.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  it('turns a listing failure into PROVIDER_UNAVAILABLE and logs only the error name', async () => {
    list.mockRejectedValue(new Error('listConnections() failed: HTTP 502'));

    await expect(listAssinafyConnections({ visibility: 'workspace' })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      details: { provider: 'twenty' },
    });
    expect(console.error).toHaveBeenCalledWith('[assinafy] listConnections failed', { name: 'Error' });
  });

  it('logs the type of a non-Error failure', async () => {
    list.mockRejectedValue('offline');

    await expect(listAssinafyConnections({})).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(console.error).toHaveBeenCalledWith('[assinafy] listConnections failed', { name: 'string' });
  });
});
