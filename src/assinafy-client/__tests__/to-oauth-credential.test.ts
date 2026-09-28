import { describe, expect, it } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { buildAppConnection } from 'src/assinafy-client/__tests__/build-app-connection';
import { toOAuthCredential } from 'src/assinafy-client/to-oauth-credential';

describe('toOAuthCredential', () => {
  it('maps a user connection to a personal credential', () => {
    expect(toOAuthCredential(buildAppConnection({ id: 'c-1', scopes: ['documents:write'] }))).toEqual({
      kind: 'personal',
      connectionId: 'c-1',
      accessToken: LEAK_SENTINELS[0],
      scopes: ['documents:write'],
    });
  });

  it('maps a workspace connection to a shared credential', () => {
    expect(toOAuthCredential(buildAppConnection({ visibility: 'workspace' })).kind).toBe('shared');
  });
});
