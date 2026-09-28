import { describe, expect, it } from 'vitest';

import { ON_DISCONNECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { onAssinafyDisconnectHandler } from 'src/logic-functions/handlers/on-assinafy-disconnect.handler';
import onAssinafyDisconnect from 'src/logic-functions/on-assinafy-disconnect.logic-function';

describe('on-assinafy-disconnect logic function', () => {
  it('keeps the identity the connection provider references and runs the revoke handler', () => {
    expect(onAssinafyDisconnect.success).toBe(true);
    expect(onAssinafyDisconnect.config).toMatchObject({
      universalIdentifier: ON_DISCONNECT_UNIVERSAL_IDENTIFIER,
      name: 'on-assinafy-disconnect',
      timeoutSeconds: 30,
      handler: onAssinafyDisconnectHandler,
    });
  });
});
