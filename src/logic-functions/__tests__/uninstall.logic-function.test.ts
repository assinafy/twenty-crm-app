import { describe, expect, it } from 'vitest';

import { UNINSTALL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { uninstallHandler } from 'src/logic-functions/handlers/uninstall.handler';
import uninstall from 'src/logic-functions/uninstall.logic-function';

describe('uninstall logic function', () => {
  it('is the uninstall hook running the revoke-all handler', () => {
    expect(uninstall.success).toBe(true);
    expect(uninstall.config).toMatchObject({
      universalIdentifier: UNINSTALL_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 120,
      handler: uninstallHandler,
    });
  });
});
