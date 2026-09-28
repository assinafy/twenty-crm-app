import { describe, expect, it } from 'vitest';

import { requirePerson } from 'src/logic-functions/utils/require-person.util';
import { type HandlerContext } from 'src/types/handler-context';

const ctx = (userWorkspaceId: string | null) => ({ userWorkspaceId }) as HandlerContext;

describe('requirePerson', () => {
  it('rejects a call without a workspace member (API key)', () => {
    expect(() => requirePerson(ctx(null))).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('accepts a signed-in member', () => {
    expect(() => requirePerson(ctx('member-1'))).not.toThrow();
  });
});
