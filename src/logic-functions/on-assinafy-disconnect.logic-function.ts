import { defineLogicFunction } from 'twenty-sdk/define';

import { ON_DISCONNECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { onAssinafyDisconnectHandler } from 'src/logic-functions/handlers/on-assinafy-disconnect.handler';

export default defineLogicFunction({
  universalIdentifier: ON_DISCONNECT_UNIVERSAL_IDENTIFIER,
  name: 'on-assinafy-disconnect',
  description: 'Revoga a autorização na Assinafy quando uma conexão com a Assinafy é removida.',
  timeoutSeconds: 30,
  handler: onAssinafyDisconnectHandler,
});
