# Assinafy para Twenty

Envie PDFs e modelos da Assinafy para assinatura a partir de Pessoas, Empresas e Oportunidades, acompanhe cada signatário e gerencie a vigência dos contratos sem sair do Twenty.

## Fluxo completo do documento

1. **Conectar:** o administrador do servidor registra uma aplicação OAuth da Assinafy e configura o ID e o segredo do cliente no Twenty. Um membro adiciona a conexão, entra na Assinafy, escolhe o workspace e aprova as permissões. Como alternativa, o workspace pode configurar uma chave de API. Uma conexão compartilhada ou a chave de API mantém as atualizações em segundo plano.
2. **Escolher:** abra uma Pessoa, Empresa ou Oportunidade e selecione Enviar para assinatura. Escolha um PDF anexado ao registro ou um modelo pronto no workspace conectado; preencha o nome, a mensagem, os campos do modelo e o prazo.
3. **Definir os signatários:** use os contatos do CRM ou preencha os dados. Para cada pessoa, escolha E-mail, WhatsApp, Certificado digital ICP-Brasil A1/A3 ou Biometria facial e documento de identidade. Selecione o canal permitido e, quando necessário, informe CPF/CNPJ. O app nunca recebe o certificado, a senha ou as evidências biométricas.
4. **Preparar:** Preparar e revisar carrega o PDF na Assinafy, ou confere o modelo, e consulta o custo. Nenhum convite é criado nessa etapa. Um PDF preparado e não enviado fica reservado para limpeza depois de 24 horas.
5. **Confirmar e enviar:** confira o workspace, o documento, os signatários, os envios recentes e a estimativa. Depois da confirmação explícita, o app consulta o custo novamente, cria o registro Enviando no Twenty e faz uma única chamada de envio com o limite de créditos confirmado. Um resultado incerto fica registrado para conferência e nunca é repetido automaticamente.
6. **Assinar e acompanhar:** cada signatário recebe o convite pelo canal escolhido. O painel atualiza o andamento, reenvia um convite depois de nova estimativa e confirmação, e cancela uma solicitação quando a Assinafy permite. O app consulta os documentos a cada 15 minutos; webhooks opcionais antecipam as atualizações.
7. **Concluir e guardar:** depois da certificação, o app copia o PDF assinado e, quando houver certificado digital, o PDF PAdES ICP-Brasil para o Twenty. O status só passa a Assinado quando todos os arquivos esperados estão guardados.
8. **Gerenciar o contrato:** no painel do documento, Gestão do contrato cadastra e consulta condições, renova a vigência e encerra o acompanhamento. Os termos ficam na Assinafy e um resumo sanitizado fica no Twenty. Essas ações não alteram o PDF, as assinaturas nem os convites; aditivos são somente leitura no Twenty.

## Recursos no Twenty

- Objeto Documentos Assinafy, relacionado a Pessoas, Empresas e Oportunidades, com status, signatários, prazo, arquivos assinados e resumo do contrato. Somente o Nome pode ser editado diretamente por membros.
- Comando Enviar para assinatura, aba Assinaturas nos registros e painel Status da assinatura no Documento Assinafy.
- Três ferramentas de IA que consultam o contexto, propõem um rascunho e consultam o status. O usuário sempre revisa, vê o custo e confirma o envio.
- Ação de fluxo de trabalho Enviar para assinatura (Assinafy), com limite de créditos, e tarefa de atualização a cada 15 minutos.
- OAuth 2.0 com PKCE, chave de API opcional, webhooks assinados opcionais, verificação de saúde, revogação no desligamento e limpeza na desinstalação.

## Requisitos

- Twenty 2.42 ou posterior.
- Conta Assinafy com plano ativo e acesso aos recursos usados. WhatsApp, certificado digital, biometria, OAuth e contratos dependem do plano.
- Aplicação OAuth confidencial registrada para o servidor Twenty ou uma chave de API da Assinafy.

## Configuração

### OAuth

1. Na Assinafy, abra Integrações → Apps OAuth → Novo aplicativo e escolha o tipo confidencial.
2. Cadastre exatamente `<SERVER_URL>/auth/apps/callback` como URI de redirecionamento HTTPS.
3. Autorize `documents:read`, `documents:write`, `templates:read`, `templates:write`, `account:read`, `webhooks:write` e `offline_access`.
4. No registro do app no servidor Twenty, configure `ASSINAFY_CLIENT_ID` e `ASSINAFY_CLIENT_SECRET`.
5. No workspace Twenty, abra Configurações → Aplicativos → Assinafy → Geral, selecione Adicionar conexão e aprove o acesso na Assinafy.

O Twenty faz o consentimento, valida o callback, troca e renova os tokens e guarda as credenciais. O app usa apenas o token do workspace aprovado. Cada renovação estende a conexão por 30 dias; uma conexão sem uso por 30 dias precisa ser refeita. Desconectar ou desinstalar revoga o token de acesso disponível, mas o Twenty não expõe o token de renovação ao app: para encerrar toda a autorização, remova o app em Aplicativos conectados na Assinafy.

### Chave de API e webhooks

Na aba Variáveis do app:

- `ASSINAFY_API_KEY`: alternativa à conexão OAuth. Todos os membros enviam como o dono da chave.
- `ASSINAFY_ACCOUNT_ID`: obrigatório quando a chave acessa mais de um workspace da Assinafy.
- `ASSINAFY_WEBHOOK_EMAIL`: ativa os webhooks e recebe avisos de falha de entrega. O servidor Twenty precisa ser público e HTTPS.

Chamadas interativas tentam a conexão pessoal, depois as conexões compartilhadas e, por último, a chave de API. Um envio usa somente a primeira credencial e nunca troca depois da primeira chamada à Assinafy. Tarefas em segundo plano usam apenas a chave de API e conexões compartilhadas. Fluxos de trabalho preferem a chave de API; sem ela, exigem que as conexões compartilhadas apontem para o mesmo workspace da Assinafy.

## Enviar para assinatura

1. Anexe um PDF de até 25 MB ao registro ou prepare um modelo na Assinafy.
2. Abra Enviar para assinatura e escolha a origem. O prazo termina às 23:59:59 do dia escolhido no fuso do navegador e precisa estar pelo menos 65 minutos à frente no envio.
3. Preencha até 20 signatários. Dois signatários não podem compartilhar o mesmo e-mail; signatários avisados por WhatsApp não podem compartilhar o mesmo número.
4. Selecione Preparar e revisar, confira a estimativa de documentos e créditos, marque a confirmação e envie. Se o custo mudar, o app mostra a nova estimativa e pede outra confirmação.

| Validação | Convite | Dados obrigatórios | Observações |
| --- | --- | --- | --- |
| E-mail | E-mail | nome e e-mail | Código de validação por e-mail. |
| WhatsApp | WhatsApp | nome e telefone E.164 | Código e convite pelo WhatsApp; o e-mail é opcional. |
| Certificado digital A1/A3 | E-mail ou WhatsApp | contato do canal e CPF/CNPJ do titular | Cada titular assina com o próprio certificado e fica sozinho em sua etapa. Funciona com PDFs e com modelos sem campos posicionados para signatários. |
| Biometria facial e documento | E-mail ou WhatsApp | contato do canal e CPF válido | Fotos, prova de vida, consentimento e decisão ficam na Assinafy. Uma análise pendente mantém o documento em acompanhamento. |

Os PDFs usam assinatura virtual, sem campos posicionados. Um modelo pode ter papéis de Signatário e Editor, até 20 signatários e 50 campos de editor. Certificado digital exige um modelo virtual, sem campos atribuídos aos signatários; o app recusa a combinação antes da estimativa. Outros papéis tornam o modelo indisponível no Twenty.

Preparar um PDF não envia convites. O mesmo upload pode ser usado pelo membro que o preparou por até 23 horas. Depois de 24 horas, a limpeza automática pode excluir apenas um upload que a Assinafy ainda informa como não enviado e que nenhum envio válido referencia.

## Acompanhamento e contratos

O painel mostra o status geral, o andamento de cada signatário, o prazo, a recusa sanitizada e os arquivos assinados. Os estados incluem preparação, aguardando assinaturas, biometria em análise, certificação, assinado, recusado, cancelado, falhou e resultado incerto. Atualizar consulta a Assinafy; Reenviar convite estima e confirma o custo; Cancelar exclui na Assinafy somente quando o documento ainda pode ser excluído; Remover do Twenty preserva o documento na Assinafy.

Os documentos em aberto dos últimos 120 dias são consultados em segundo plano. Contratos acompanhados continuam sendo consultados sem esse limite. Webhooks autenticados apenas aceleram o processo: o app valida o token e a assinatura e então relê o documento na Assinafy, sem confiar nem guardar o corpo recebido.

Gestão do contrato permite salvar contraparte, valor, moeda, início, fim, renovação automática, período de renovação e antecedência do aviso. Alterações usam a versão lida para impedir sobrescrita concorrente. Renovar também confere o termo atual. Um resultado incerto exige Atualizar contrato antes de outra alteração.

## Chat de IA e fluxos de trabalho

O chat pode consultar anexos, modelos e contatos e montar um rascunho. Ele não carrega, cobra nem envia: o cartão abre o mesmo fluxo de revisão e confirmação do membro.

A ação de workflow aceita um PDF ou modelo, pessoas do CRM, nome, mensagem, prazo, E-mail ou WhatsApp e Máximo de créditos. Zero permite apenas documentos cobertos pelo plano. Modelos com campos de editor não são aceitos no workflow. Cada execução é um novo envio; deixe a repetição automática da etapa desativada.

## Permissões e dados

- A função do app lê Pessoas, Empresas, Oportunidades e Anexos, sem alterá-los, e gerencia somente Documentos Assinafy. Ações de membros também respeitam as permissões do próprio membro.
- Status, sincronização, contratos, workflows e uploads dos PDFs assinados gravam como aplicação. A criação do registro Enviando usa o membro que confirmou o envio.
- A Assinafy recebe o PDF, nome, mensagem, prazo, condições contratuais e os dados necessários de cada signatário. CPF/CNPJ, certificado, senha e evidências biométricas nunca são guardados no Twenty.
- O Twenty guarda IDs, status, contatos dos signatários, métodos escolhidos, arquivos assinados e o resumo permitido do contrato. Links de assinatura não são guardados.
- Tokens OAuth ficam no Twenty. Chaves, tokens, segredos, links, respostas da Assinafy e contatos dos signatários não entram em logs.
- Desinstalar remove do Twenty os registros e PDFs guardados pelo app, mas não cancela nem exclui documentos na Assinafy. Baixe os arquivos necessários e revogue a autorização na Assinafy.

## Limitações

- São considerados os 50 anexos e os 50 Documentos Assinafy mais recentes do registro, até 10 contatos relacionados e os primeiros 200 modelos prontos do workspace.
- Um signatário somente com WhatsApp, sem e-mail, pode gerar um novo perfil na Assinafy a cada envio. Alterar o WhatsApp de um perfil existente pode invalidar convites pendentes enviados ao número antigo.
- Sem webhooks, as mudanças aparecem na próxima consulta de 15 minutos, ao abrir o documento ou ao selecionar Atualizar. A expiração depende da consulta periódica.
- No Twenty 2.42, renovações OAuth simultâneas podem reutilizar o mesmo token rotativo e encerrar a conexão; reconecte pela aba Geral.
- Depois de instalar ou reinstalar, uma sessão antiga do navegador pode mostrar No Data nos widgets. Limpe os dados do site do Twenty e entre novamente.

## Solução de problemas

| Código ou aviso | O que fazer |
| --- | --- |
| `NOT_CONNECTED` | Adicione uma conexão ou configure a chave de API; tarefas em segundo plano precisam de uma credencial compartilhada. |
| `RECONNECT_REQUIRED` | Reconecte o OAuth ou substitua a chave de API recusada. |
| `INSUFFICIENT_SCOPE` | Reconecte e aprove todas as sete permissões. |
| `ACCOUNT_REQUIRED` | Configure `ASSINAFY_ACCOUNT_ID` ou mantenha as conexões compartilhadas no mesmo workspace Assinafy. |
| `INSUFFICIENT_RESOURCES` ou `COST_LIMIT_EXCEEDED` | Regularize o plano, adicione documentos/créditos ou aumente o limite do workflow. |
| `COST_CHANGED` | Confira a nova estimativa e confirme novamente. |
| `UNCERTAIN` | Confira o documento na Assinafy antes de tentar qualquer novo envio ou reenvio. |
| `CONTRACT_CHANGED` ou `CONTRACT_UNCERTAIN` | Selecione Atualizar contrato, confira o resultado e só então altere novamente. |
| Webhooks ainda não registrados | Aguarde uma execução de até 15 minutos; confira a URL pública, o espaço de endpoint e a permissão `webhooks:write`. |

## Suporte

- Problemas e sugestões: https://github.com/assinafy/twenty-crm-app/issues
- Site e contato: https://www.assinafy.com.br e https://www.assinafy.com.br/contato
- Termos e privacidade: https://www.assinafy.com.br/termos-de-uso e https://www.assinafy.com.br/politica-de-privacidade
- Desenvolvimento e operação: [SETUP.md](SETUP.md)
- Contratos completos da API usados pelo app: [docs/ASSINAFY_API.md](docs/ASSINAFY_API.md)
