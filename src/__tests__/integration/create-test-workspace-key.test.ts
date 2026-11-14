import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/__tests__/integration/post-graphql', () => ({ postGraphql: vi.fn<typeof postGraphql>() }));

import { createTestWorkspaceKey } from 'src/__tests__/integration/create-test-workspace-key';
import { postGraphql } from 'src/__tests__/integration/post-graphql';

const post = vi.mocked(postGraphql);
const role = { id: 'role-1', canReadAllObjectRecords: true, canUpdateAllObjectRecords: true, canDestroyAllObjectRecords: true, canAccessAllTools: true, canUpdateAllSettings: true };

beforeEach(() => post.mockReset());

describe('temporary workspace test key', () => {
  it('uses a full-access role, expires in one hour and revokes idempotently', async () => {
    post.mockResolvedValueOnce({ getApiKeyRoles: [{ ...role, id: 'read-only', canUpdateAllObjectRecords: false }, role] })
      .mockResolvedValueOnce({ createApiKey: { id: 'key-1' } })
      .mockResolvedValueOnce({ generateApiKeyToken: { token: 'synthetic-key' } })
      .mockResolvedValueOnce({ revokeApiKey: { id: 'key-1' } });
    const start = Date.now();
    const key = await createTestWorkspaceKey('http://localhost:2021', 'synthetic-member');
    expect(key.token).toBe('synthetic-key');
    const input = post.mock.calls[1]![3]?.input as { roleId: string; expiresAt: string };
    expect(input.roleId).toBe('role-1');
    expect(Date.parse(input.expiresAt) - start).toBeGreaterThanOrEqual(3_600_000);
    expect(Date.parse(input.expiresAt) - Date.now()).toBeLessThanOrEqual(3_600_000);
    await key.revoke();
    await key.revoke();
    expect(post).toHaveBeenCalledTimes(4);
    expect(post.mock.calls[3]![3]).toEqual({ input: { id: 'key-1' } });
    expect(post.mock.calls.every(([url, token]) => url === 'http://localhost:2021/metadata' && token === 'synthetic-member')).toBe(true);
  });

  it.each(['canUpdateAllObjectRecords', 'canAccessAllTools', 'canUpdateAllSettings'])('refuses an underprivileged key role: %s', async (permission) => {
    post.mockResolvedValueOnce({ getApiKeyRoles: [{ ...role, [permission]: false }] });
    await expect(createTestWorkspaceKey('http://localhost:2021', 'synthetic-member')).rejects.toThrow('Could not create');
    expect(post).toHaveBeenCalledOnce();
  });

  it('revokes a created key when token generation fails and hides response details', async () => {
    post.mockResolvedValueOnce({ getApiKeyRoles: [role] })
      .mockResolvedValueOnce({ createApiKey: { id: 'key-1' } })
      .mockRejectedValueOnce(new Error('synthetic-secret in response'))
      .mockResolvedValueOnce({});
    await expect(createTestWorkspaceKey('http://localhost:2021', 'synthetic-member')).rejects.toThrow(
      'Could not create the temporary Twenty test API key. Check the seeded member permissions.',
    );
    expect(post.mock.calls[3]![3]).toEqual({ input: { id: 'key-1' } });
  });

  it('reports failed cleanup without exposing the provider response', async () => {
    post.mockResolvedValueOnce({ getApiKeyRoles: [role] })
      .mockResolvedValueOnce({ createApiKey: { id: 'key-1' } })
      .mockResolvedValueOnce({ generateApiKeyToken: { token: 'synthetic-key' } })
      .mockRejectedValueOnce(new Error('synthetic-secret in response'));
    const key = await createTestWorkspaceKey('http://localhost:2021', 'synthetic-member');
    await expect(key.revoke()).rejects.toThrow('Could not revoke the temporary Twenty test API key; it expires after one hour.');
  });
});
