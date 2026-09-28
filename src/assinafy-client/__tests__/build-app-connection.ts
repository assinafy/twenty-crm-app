import { type AppConnection } from 'twenty-sdk/logic-function';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';

export const buildAppConnection = (overrides: Partial<AppConnection> = {}): AppConnection => ({
  id: 'connection-1',
  providerName: 'assinafy',
  name: 'Assinafy',
  handle: 'member@example.invalid',
  visibility: 'user',
  userWorkspaceId: 'member-1',
  workspaceMemberId: 'workspace-member-1',
  accessToken: LEAK_SENTINELS[0],
  scopes: ['documents:read'],
  authFailedAt: null,
  authFailedReason: null,
  ...overrides,
});
