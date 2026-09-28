import { describe, expect, it } from 'vitest';

import { buildAppConnection } from 'src/assinafy-client/__tests__/build-app-connection';
import { isUsableConnection } from 'src/assinafy-client/is-usable-connection';

describe('isUsableConnection', () => {
  it('accepts the requesting member own personal connection', () => {
    expect(isUsableConnection(buildAppConnection({ userWorkspaceId: 'member-1' }), 'member-1')).toBe(true);
  });

  it('rejects another member personal connection', () => {
    expect(isUsableConnection(buildAppConnection({ userWorkspaceId: 'member-2' }), 'member-1')).toBe(false);
  });

  it('rejects every personal connection when no member is present', () => {
    expect(isUsableConnection(buildAppConnection(), null)).toBe(false);
  });

  it('accepts a shared connection created by anyone, with or without a member', () => {
    const shared = buildAppConnection({ visibility: 'workspace', userWorkspaceId: 'member-2' });
    expect(isUsableConnection(shared, 'member-1')).toBe(true);
    expect(isUsableConnection(shared, null)).toBe(true);
  });

  it('rejects connections flagged as failed', () => {
    const failed = buildAppConnection({ visibility: 'workspace', authFailedAt: '2026-09-01T00:00:00.000Z' });
    expect(isUsableConnection(failed, 'member-1')).toBe(false);
  });

  it('rejects connections of another provider', () => {
    expect(isUsableConnection(buildAppConnection({ providerName: 'other' }), 'member-1')).toBe(false);
  });
});
