import { postGraphql } from 'src/__tests__/integration/post-graphql';

// The test server no longer exposes a seeded API key through the SDK.
export const createTestWorkspaceKey = async (apiUrl: string, memberToken: string) => {
  const endpoint = `${apiUrl}/metadata`;
  let id: string | undefined;
  const revoke = async () => {
    if (!id) return;
    try {
      await postGraphql(endpoint, memberToken,
        'mutation ($input: RevokeApiKeyInput!) { revokeApiKey(input: $input) { id } }', { input: { id } });
      id = undefined;
    } catch {
      throw new Error('Could not revoke the temporary Twenty test API key; it expires after one hour.');
    }
  };
  try {
    const { getApiKeyRoles: roles } = await postGraphql<{ getApiKeyRoles: Array<{
      id: string; canReadAllObjectRecords: boolean; canUpdateAllObjectRecords: boolean; canDestroyAllObjectRecords: boolean; canAccessAllTools: boolean; canUpdateAllSettings: boolean;
    }> }>(endpoint, memberToken, 'query { getApiKeyRoles { id canReadAllObjectRecords canUpdateAllObjectRecords canDestroyAllObjectRecords canAccessAllTools canUpdateAllSettings } }');
    const role = roles.find((candidate) => candidate.canReadAllObjectRecords && candidate.canUpdateAllObjectRecords && candidate.canDestroyAllObjectRecords && candidate.canAccessAllTools && candidate.canUpdateAllSettings);
    if (!role) throw new Error('No test role with full record access.');
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const { createApiKey: key } = await postGraphql<{ createApiKey: { id: string } }>(endpoint, memberToken,
      'mutation ($input: CreateApiKeyInput!) { createApiKey(input: $input) { id } }',
      { input: { name: 'Assinafy integration tests', expiresAt, roleId: role.id } });
    id = key.id;
    const { generateApiKeyToken: { token } } = await postGraphql<{ generateApiKeyToken: { token: string } }>(endpoint, memberToken,
      'mutation ($id: UUID!, $expiresAt: String!) { generateApiKeyToken(apiKeyId: $id, expiresAt: $expiresAt) { token } }',
      { id, expiresAt });
    return { token, revoke };
  } catch {
    await revoke();
    throw new Error('Could not create the temporary Twenty test API key. Check the seeded member permissions.');
  }
};
