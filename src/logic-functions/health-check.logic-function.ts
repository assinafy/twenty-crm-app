import { defineHealthCheck } from 'twenty-sdk/define';

import { createAssinafyClient } from 'src/assinafy-client/create-assinafy-client';
import { HEALTH_CHECK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { healthCheckHandler } from 'src/logic-functions/handlers/health-check.handler';

export default defineHealthCheck({
  universalIdentifier: HEALTH_CHECK_UNIVERSAL_IDENTIFIER,
  name: 'health-check',
  description:
    'Avisa na página de configurações do aplicativo quando nenhuma credencial do workspace está configurada para ' +
    'as atualizações em segundo plano ou quando a Assinafy recusa uma delas.',
  timeoutSeconds: 20,
  handler: () => healthCheckHandler(createAssinafyClient),
});
