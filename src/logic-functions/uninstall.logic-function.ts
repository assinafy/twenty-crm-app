import { defineUninstallLogicFunction } from 'twenty-sdk/define';

import { UNINSTALL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { uninstallHandler } from 'src/logic-functions/handlers/uninstall.handler';

export default defineUninstallLogicFunction({
  universalIdentifier: UNINSTALL_UNIVERSAL_IDENTIFIER,
  name: 'uninstall',
  description: 'Revoga todas as autorizações da Assinafy do workspace antes de o aplicativo ser removido.',
  timeoutSeconds: 120,
  handler: uninstallHandler,
});
