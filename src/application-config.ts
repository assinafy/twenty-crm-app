import { defineApplication } from 'twenty-sdk/define';

import {
  ASSINAFY_ACCOUNT_ID_VARIABLE,
  ASSINAFY_API_KEY_VARIABLE,
  ASSINAFY_CLIENT_ID_VARIABLE,
  ASSINAFY_CLIENT_SECRET_VARIABLE,
} from 'src/constants/assinafy';
import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  ASSINAFY_ACCOUNT_ID_VARIABLE_UNIVERSAL_IDENTIFIER,
  ASSINAFY_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  author: 'Assinafy',
  category: 'Sales',
  logo: 'public/logo.svg',
  websiteUrl: 'https://www.assinafy.com.br',
  termsUrl: 'https://www.assinafy.com.br/termos-de-uso',
  issueReportUrl: 'https://github.com/assinafy/twenty-crm-app/issues',
  serverVariables: {
    [ASSINAFY_CLIENT_ID_VARIABLE]: {
      description:
        'ID do cliente da aplicação OAuth da Assinafy, cadastrada com a URI de redirecionamento <SERVER_URL>/auth/apps/callback. Deixe em branco para usar apenas chaves de API.',
      isSecret: false,
      isRequired: false,
    },
    [ASSINAFY_CLIENT_SECRET_VARIABLE]: {
      description: 'Segredo do cliente da aplicação OAuth da Assinafy.',
      isSecret: true,
      isRequired: false,
    },
  },
  applicationVariables: {
    [ASSINAFY_API_KEY_VARIABLE]: {
      universalIdentifier: ASSINAFY_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Chave de API da Assinafy',
      description:
        'Alternativa opcional à conexão de uma conta Assinafy. Com ela, todos os membros do workspace enviam em nome do proprietário desta chave. Crie-a para um usuário exclusivo da Assinafy.',
      isSecret: true,
      isRequired: false,
    },
    [ASSINAFY_ACCOUNT_ID_VARIABLE]: {
      universalIdentifier: ASSINAFY_ACCOUNT_ID_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'ID do workspace na Assinafy',
      description:
        'Obrigatório apenas quando a chave de API pertence a um usuário com acesso a mais de um workspace da Assinafy.',
      isSecret: false,
      isRequired: false,
    },
  },
});
