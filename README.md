# Assinafy para Twenty

Envie PDFs e modelos da Assinafy para assinatura eletrônica a partir de Pessoas, Empresas e Oportunidades e acompanhe cada assinatura sem sair do Twenty.

## Fluxo completo do documento

1. **Conectar:** o administrador configura uma aplicação OAuth da Assinafy no servidor Twenty. Um membro adiciona a conexão, entra na Assinafy, escolhe o workspace e aprova as permissões. O Twenty recebe a autorização e mantém os tokens; o app usa o workspace aprovado. Para usar uma chave de API, configure-a nas variáveis do app. Uma conexão compartilhada ou uma chave de API permite acompanhar os documentos em segundo plano.
2. **Escolher:** abra uma Pessoa, Empresa ou Oportunidade e selecione Enviar para assinatura. Escolha um PDF anexado ao registro ou um modelo pronto do workspace conectado. Preencha o nome, a mensagem opcional, os campos do modelo e o prazo.
3. **Definir os signatários:** confira os contatos e selecione e-mail, WhatsApp ou certificado digital ICP-Brasil A1/A3 para cada assinatura. O certificado fica com o titular; o app não recebe o arquivo do certificado nem a senha. Com certificado, cada signatário assina em sua própria etapa.
4. **Preparar:** Preparar e revisar carrega o PDF na Assinafy ou confere o modelo e consulta o custo. Esta etapa não cria convites. Se desistir antes de enviar, o app tenta descartar o PDF não enviado; a limpeza em segundo plano trata os uploads acompanhados que sobrarem.
5. **Confirmar e enviar:** confira o workspace, os signatários, os envios recentes e o custo. Depois da sua confirmação, o app confere novamente o custo e cria o registro Enviando no Twenty antes de solicitar as assinaturas. O convite só é solicitado nessa etapa. Uma tentativa repetida no mesmo fluxo reaproveita a solicitação; quando o resultado não é confirmado, o registro permanece para conferência.
6. **Assinar e acompanhar:** os signatários recebem o convite pelo canal escolhido e validam a assinatura na Assinafy. O painel permite atualizar o andamento, reenviar convites com conferência de custo e cancelar quando permitido. As atualizações em segundo plano acontecem a cada 15 minutos para os documentos dentro da janela de acompanhamento.
7. **Concluir e guardar:** depois que todos assinam, a Assinafy finaliza o documento. O app copia o PDF assinado e, quando disponível, o PDF ICP-Brasil para o Twenty. O status passa a Assinado somente depois que os arquivos esperados estão guardados. Baixe-os no painel ou na aba Assinaturas.

As seções abaixo detalham a configuração, cada etapa, os status, as permissões e as limitações.

## O que o app faz

- Envia para assinatura eletrônica um PDF anexado a uma Pessoa, Empresa ou Oportunidade, ou um modelo pronto da Assinafy, em três etapas: Documento, Signatários e Revisar e enviar.
- Valida cada signatário por e-mail, por WhatsApp ou com Certificado digital ICP-Brasil (A1 ou A3), com assinaturas em paralelo ou uma por vez, em uma ordem definida.
- Mostra a estimativa de custo da Assinafy em tempo real (documentos do plano e créditos) antes de qualquer envio e pede confirmação explícita. O custo é conferido novamente logo antes do envio.
- Mantém no Twenty um registro de Documento Assinafy para cada solicitação, vinculado à Pessoa, Empresa ou Oportunidade de origem, com o status, o andamento dos signatários e o prazo para assinar.
- Guarda o PDF assinado e, quando houver certificado digital, o PDF com certificado ICP-Brasil no campo Documento assinado do registro.
- Reenvia o convite a um signatário que ainda não assinou, cancela uma solicitação pendente e atualiza os status em segundo plano a cada 15 minutos.
- Permite que o chat de IA prepare uma solicitação de assinatura para você revisar e enviar, e adiciona uma ação de fluxo de trabalho que envia documentos para assinatura com um limite de créditos.

## O que o app adiciona ao Twenty

- **Objeto:** Documento Assinafy (Documentos Assinafy). Os registros são criados pelo app quando você envia uma solicitação; não é possível criá-los pela interface do Twenty.
- **Campos do Documento Assinafy:** Nome, Status, Signatários (quantidade), Assinados (quantidade), Detalhes dos signatários, Enviado em, Concluído em, Prazo para assinar, Última verificação, Motivo da recusa, Último erro, Documento assinado (até dois arquivos), Modelo, ID do documento na Assinafy, ID do workspace na Assinafy, ID da solicitação na Assinafy, ID do envio e relações com Pessoa, Empresa e Oportunidade. Os membros podem editar apenas o Nome; todos os outros campos são gravados somente pelo app. Um índice único no ID do envio garante um registro por tentativa de envio.
- **Campos nos objetos padrão:** uma relação Documentos Assinafy em Pessoa, Empresa e Oportunidade. Quando uma Pessoa, Empresa ou Oportunidade vinculada é excluída definitivamente, os Documentos Assinafy dela são mantidos e o vínculo é removido.
- **Visualização e navegação:** a visualização Documentos Assinafy (Nome, Status, Assinados, Signatários, Enviado em, Concluído em, Documento assinado, Pessoa, Empresa, Oportunidade; os criados mais recentemente primeiro) e o item Documentos Assinafy no menu de navegação.
- **Layouts de página:** uma aba Assinaturas nas páginas de registro de Pessoa, Empresa e Oportunidade, e uma aba Assinatura, a primeira do Documento Assinafy, com o painel Status da assinatura. As abas nativas Início, Linha do Tempo e Arquivos continuam disponíveis.
- **Componentes de interface:** o fluxo de envio, a aba Assinaturas (lista de documentos, downloads e o fluxo de envio), o painel de status do documento e o cartão do chat de IA que exibe uma solicitação proposta.
- **Comando:** Enviar para assinatura, fixado em Pessoa, Empresa e Oportunidade quando exatamente um registro está selecionado.
- **Funções lógicas:**
  - Sete rotas usadas pelos painéis: `/assinafy/context`, `/assinafy/prepare`, `/assinafy/send`, `/assinafy/discard`, `/assinafy/documents/refresh`, `/assinafy/documents/resend` e `/assinafy/documents/cancel`. Todas são `POST`, exigem um membro do workspace autenticado e não são públicas.
  - Três ferramentas de IA: `get-signature-context-tool`, `propose-signature-request` e `get-assinafy-document-status`.
  - Uma ação de fluxo de trabalho: Enviar para assinatura (Assinafy).
  - Uma tarefa agendada, `sync-assinafy-documents`, a cada 15 minutos.
  - Uma verificação de saúde que informa problemas de credenciais na página de configurações do app.
  - Duas funções de ciclo de vida: `on-assinafy-disconnect` revoga o token de acesso disponível quando uma conexão é removida, mesmo que ela esteja marcada para reconexão, e `uninstall` faz isso para todas as conexões antes de o app ser removido. Elas só executam a revogação quando chamadas pelo próprio Twenty; uma execução iniciada por um membro é ignorada. Para encerrar também a autorização de renovação, revogue o app em Aplicativos conectados na Assinafy.
- **Provedor de conexão:** OAuth 2.0 da Assinafy com PKCE, solicitando `documents:read documents:write templates:read templates:write account:read offline_access`.
- **Tipo de atividade na linha do tempo:** "criou uma solicitação de assinatura", na linha do tempo da Pessoa, Empresa ou Oportunidade vinculada.
- **Função:** Assinafy, a função própria do app, com o mínimo de privilégios (veja Permissões e dados).
- **Variáveis:** as variáveis de servidor `ASSINAFY_CLIENT_ID` e `ASSINAFY_CLIENT_SECRET` e as variáveis do aplicativo `ASSINAFY_API_KEY` (chave de API da Assinafy) e `ASSINAFY_ACCOUNT_ID` (ID do workspace na Assinafy). Nenhuma é obrigatória isoladamente; você precisa de uma conexão ou de uma chave de API.

## Requisitos

- Twenty 2.42 ou posterior.
- Uma conta da Assinafy com plano ativo. A validação por WhatsApp e os certificados ICP-Brasil dependem do seu plano da Assinafy e podem consumir créditos; a etapa de revisão sempre mostra o custo exato.
- Uma forma de acessar a Assinafy:
  - **OAuth (recomendado):** uma aplicação OAuth da Assinafy registrada para o seu servidor Twenty. Para criá-la, é preciso um plano da Assinafy que inclua aplicações OAuth e o papel de proprietário no workspace da Assinafy que será dono dela.
  - **Chave de API:** a chave de API de um usuário da Assinafy, configurada nas variáveis do app.

## Configuração

### 1. Administrador do servidor: registre a aplicação OAuth na Assinafy

Pule esta parte se o workspace for usar apenas uma chave de API.

1. Na Assinafy, abra Integrações → Apps OAuth → Novo aplicativo.
2. Preencha:
   - **Tipo:** confidencial. Não é possível alterá-lo depois.
   - **URI de redirecionamento:** exatamente `<SERVER_URL>/auth/apps/callback`, em que `<SERVER_URL>` é a URL base pública do seu servidor Twenty (por exemplo, `https://twenty.example.com/auth/apps/callback`). Ela precisa usar `https://`, e uma barra no final a torna um endereço diferente. Todos os workspaces do servidor compartilham essa mesma URI de redirecionamento.
   - **Permissões:** `documents:read`, `documents:write`, `templates:read`, `templates:write`, `account:read` e `offline_access`.
3. Copie o ID do cliente e o segredo do cliente. A Assinafy mostra o segredo uma única vez.
4. No Twenty, abra o app Assinafy instalado como administrador do servidor e preencha as variáveis de servidor `ASSINAFY_CLIENT_ID` e `ASSINAFY_CLIENT_SECRET`. No Twenty Cloud, o dono do app define essas variáveis uma única vez para toda a instância, na aba Configuração do registro do app.

As novas aplicações OAuth da Assinafy não são verificadas: a tela de aprovação avisa que a Assinafy não analisou o app, e a aplicação pode ser conectada a no máximo 25 workspaces da Assinafy. Peça à Assinafy que verifique a aplicação antes de disponibilizá-la ao público.

### 2. Workspace: conecte a Assinafy

Abra Configurações → Aplicativos → Assinafy.

- **Com OAuth:** na aba Geral, na seção de conexões, selecione Adicionar conexão e aprove as permissões na Assinafy. No Twenty 2.42, uma conexão adicionada ali é compartilhada com todo o workspace: todos os membros enviam como o usuário da Assinafy que conectou, a partir do workspace da Assinafy desse usuário. Conecte com um usuário dedicado da Assinafy que tenha apenas o acesso de que a equipe precisa. Uma conexão compartilhada (ou uma chave de API) também é o que mantém os status atualizados em segundo plano.
- **Com chave de API:** na aba Variáveis, preencha a chave de API da Assinafy (`ASSINAFY_API_KEY`). Todos os membros passam a enviar como o dono da chave. Crie a chave para um usuário dedicado da Assinafy com acesso mínimo. Se esse usuário pertencer a mais de um workspace da Assinafy, preencha também o ID do workspace na Assinafy (`ASSINAFY_ACCOUNT_ID`) com o workspace de onde os envios devem sair. Se você usa apenas uma chave de API, pode ignorar o aviso da aba Geral de que a conexão ainda depende de um administrador do servidor.

Quando as duas formas existem, a conexão do próprio membro é usada primeiro, depois as conexões compartilhadas e, por fim, a chave de API. Com várias conexões compartilhadas, vale a primeira pelo nome (Assinafy #1 antes de Assinafy #2). Um envio pelo painel usa apenas a primeira dessas credenciais e não tenta outra se ela for recusada; as consultas e ações em um documento existente usam a primeira que acessa o workspace da Assinafy dele. As tarefas em segundo plano usam a chave de API e as conexões compartilhadas, cada uma para os documentos do workspace da Assinafy que ela acessa. Os fluxos de trabalho enviam somente com a chave de API quando ela está preenchida e, sem ela, com as conexões compartilhadas; se a Assinafy recusar a credencial escolhida, o envio falha sem tentar outra.

### 3. Mantenha a conexão ativa

- Cada renovação do token OAuth vale por mais 30 dias, então uma conexão em uso continua ativa. Ela só expira depois de 30 dias sem uso ou quando é revogada na Assinafy. A tarefa em segundo plano não usa as conexões quando não há documentos em aberto, então uma conexão compartilhada usada apenas por um fluxo de trabalho mensal, num workspace sem documentos aguardando assinatura, pode expirar; nesse caso, reconecte pela aba Geral.
- Quando uma conexão expira ou é revogada na Assinafy, o app a marca para que a aba Geral peça a reconexão. Uma conexão expirada é marcada na primeira verificação feita pelo menos uma hora depois. Se não restar outra conexão compartilhada nem uma chave de API para as tarefas em segundo plano, a verificação de saúde mostra um aviso na página de configurações do app.
- As conexões pertencem ao membro do Twenty que as adicionou. Remover esse membro do workspace (ou ele excluir a própria conta) encerra as conexões dele, inclusive as compartilhadas: o Twenty apaga os tokens, e a conexão some da aba Geral sem ser revogada na Assinafy. Antes de remover um membro, remova na aba Geral as conexões que ele adicionou, revogue as autorizações em Aplicativos conectados na Assinafy e adicione uma nova conexão compartilhada com outro membro. Se o membro já foi removido, adicione uma nova conexão e revogue a antiga em Aplicativos conectados, no perfil do usuário da Assinafy.
- Ao desconectar ou desinstalar, o Twenty apaga os tokens locais e o app tenta revogar o token de acesso disponível. Essa revogação não encerra o token de renovação na Assinafy. Para encerrar completamente a autorização, revogue o app em Aplicativos conectados, no perfil do usuário da Assinafy.
- Uma chave de API continua funcionando até ser excluída na Assinafy.

## Uso

### Enviar um documento

1. Anexe o PDF (até 25 MB) à Pessoa, Empresa ou Oportunidade na aba Arquivos. O app lista os 50 anexos mais recentes do registro e oferece os PDFs entre eles.
2. Abra o registro e selecione o comando fixado Enviar para assinatura, ou abra a aba Assinaturas e selecione Enviar para assinatura.
3. **Documento:** escolha a Origem do documento: PDF anexado a este registro ou Modelo da Assinafy. O Nome do documento acompanha o PDF ou o modelo escolhido (o nome do arquivo sem `.pdf`, ou o nome de documento do modelo) até você digitar outro; trocar o PDF, o modelo ou a origem atualiza um nome preenchido pelo fluxo e mantém um nome digitado ou proposto pelo assistente de IA. Se quiser, informe uma Mensagem para os signatários e um Prazo para assinar. Os signatários podem assinar até 23:59:59 do dia escolhido, no fuso horário do navegador; no momento do envio, o prazo precisa estar pelo menos 65 minutos à frente.
4. **Signatários:** o fluxo começa com o signatário natural do registro (a própria Pessoa ou o contato principal da Oportunidade) e permite Preencher com um contato usando até 10 outras pessoas da empresa relacionada (as cadastradas primeiro); para outra pessoa, preencha os dados do signatário manualmente. Preencher com um contato substitui os dados do signatário e deixa o CPF/CNPJ em branco, porque os contatos do CRM não o têm. Adicione até 20 signatários para um PDF. Para cada signatário, escolha a Validação da assinatura:
   - **E-mail:** o convite e o código de validação vão para o e-mail do signatário, que é obrigatório.
   - **WhatsApp:** o convite e o código vão pelo WhatsApp. O WhatsApp com DDI, por exemplo `+55 11 90000-0000`, é obrigatório, e o e-mail é opcional.
   - **Certificado digital ICP-Brasil (A1 ou A3):** o titular assina na Assinafy com o próprio certificado. Informe o CPF (11 dígitos) ou o CNPJ (14 dígitos) do titular do certificado e escolha em Enviar convite por a opção E-mail ou WhatsApp, com o contato correspondente.

   Dois signatários não podem ter o mesmo e-mail, e dois signatários por WhatsApp não podem ter o mesmo número.
5. **Ordem de assinatura:** marque Assinar um por vez, na ordem da lista para avisar cada signatário somente depois que o anterior assinar. Sem essa opção, todos são convidados ao mesmo tempo. Um signatário com certificado precisa assinar sozinho na própria etapa, por isso a ordem é ativada automaticamente quando algum signatário usa certificado.
6. Selecione Preparar e revisar. Para um PDF, é nesse momento que o arquivo é enviado à Assinafy, para que o custo do envio possa ser estimado. Nenhum convite é enviado nesta etapa.
7. **Revisar e enviar:** confira o workspace da Assinafy, o documento, os signatários e o Custo: o total em créditos, os documentos do plano que serão usados (ou o documento adicional comprado quando os documentos do plano acabaram) e o seu saldo. Se o saldo não for suficiente, o motivo é exibido e o envio fica bloqueado. Quando o registro tem documentos criados na última hora que podem ter chegado aos signatários (qualquer status, exceto Falhou), a etapa mostra o aviso "Envios recentes deste registro" com o nome e o status desses documentos (até 5), para você conferi-los na aba Assinaturas do registro ou na lista Documentos Assinafy, e só libera o envio depois que você marca "Conferi os envios recentes e quero enviar um novo documento.". Marque a caixa de confirmação e selecione Enviar para assinatura. O app confere o custo novamente logo antes do envio; se ele tiver mudado, você vê a nova estimativa e confirma de novo.

O documento abre no painel lateral assim que a Assinafy aceita a solicitação. Se a resposta do envio não chegar (por exemplo, a conexão com o Twenty caiu), o fluxo continua aberto na revisão: selecione Enviar para assinatura novamente nesse mesmo fluxo, e a nova tentativa reaproveita a mesma solicitação, então o documento não é enviado duas vezes. Um envio começado do zero, depois de fechar o fluxo ou recarregar a página, não reaproveita a solicitação anterior: antes de enviar de novo, confira na aba Assinaturas do registro se o documento já aparece como Enviando, Aguardando assinaturas ou Confira na Assinafy.

### Modelos

A lista Modelo mostra os modelos prontos do seu workspace da Assinafy (os 200 primeiros). Cada papel de signatário do modelo recebe exatamente um signatário, por isso não é possível adicionar nem remover signatários. Todos os Campos do modelo atribuídos a editores precisam ser preenchidos. Modelos com papéis além de signatários e editores, como destinatários de cópia, e modelos com mais de 20 papéis de signatário ou mais de 50 campos para preencher aparecem como indisponíveis. O posicionamento dos campos de assinatura é preparado no próprio modelo da Assinafy.

### Acompanhar as assinaturas

A aba Assinaturas lista os Documentos Assinafy do registro com o status, o andamento e os links para download. Voltar aos documentos recarrega a lista, e um envio que ainda estava em andamento a recarrega de novo quando termina, então um envio que falhou ou não foi confirmado aparece sem precisar selecionar Atualizar. Abra um documento para ver o painel Status da assinatura, na aba Assinatura: o status, o andamento de cada signatário, as datas, os arquivos assinados e as ações que o status permite. Ao abrir um documento que não está em um status final, o app o atualiza pela Assinafy se a última verificação tiver sido há mais de 5 minutos; Atualizar faz isso a qualquer momento.

| Status | Significado |
| --- | --- |
| Enviando | A solicitação está sendo enviada à Assinafy. Atualize em instantes. |
| Aguardando assinaturas | A Assinafy enviou os convites e aguarda as assinaturas. |
| Finalizando | Todos assinaram e a Assinafy está certificando o documento, ou o PDF assinado ainda está sendo copiado para o Twenty. |
| Assinado | Todos os signatários assinaram e os PDFs assinados estão guardados no campo Documento assinado. |
| Recusado | Um signatário recusou. O motivo é exibido quando a Assinafy o informa, com links, e-mails e números longos substituídos por [link], [e-mail] e [número] e limitado a 300 caracteres; o texto completo continua na Assinafy. |
| Cancelado | A solicitação foi cancelada pelo Twenty ou na Assinafy, ou o documento foi excluído na Assinafy. |
| Expirado | O prazo para assinar terminou. Prorrogue-o na Assinafy para coletar as assinaturas que faltam; o status volta para Aguardando assinaturas na próxima vez que o documento for atualizado (abra-o ou selecione Atualizar). |
| Falhou | A solicitação não chegou aos signatários. Remova-a e envie novamente. |
| Confira na Assinafy | A Assinafy não confirmou a solicitação, então ela pode ou não ter sido enviada. Para um PDF, o app descobre sozinho na próxima atualização. Para um modelo, confira na Assinafy; se o documento não estiver lá, remova-o do Twenty e envie novamente. |
| Desconhecido | A Assinafy informou um status que o app não reconhece. |

Cada signatário aparece como Assinou, Recusou, Falha na entrega, Não assinou (a solicitação foi cancelada ou recusada antes da assinatura dele), Convite pendente (a Assinafy ainda não enviou o convite), Aguardando signatários anteriores (em uma ordem de assinatura, até que as etapas anteriores sejam assinadas) ou Convidado.

Quando o documento é assinado, o PDF certificado é guardado como `<nome do documento> - assinado.pdf` e, se um certificado digital foi usado, o PDF PAdES como `<nome do documento> - ICP-Brasil.pdf`, os dois no campo Documento assinado e como links para download no painel e na aba Assinaturas.

### Reenviar, cancelar e remover

- **Reenviar convite:** disponível em Aguardando assinaturas para um signatário que foi avisado e ainda não assinou. O app consulta antes o preço do reenvio na Assinafy, mostra o custo e pede sua confirmação, inclusive quando o reenvio não consome créditos.
- **Cancelar solicitação:** disponível em Aguardando assinaturas. Exclui a solicitação na Assinafy, e os links de assinatura deixam de funcionar. Não é possível desfazer. Logo após o envio, a Assinafy pode recusar o cancelamento de um documento que ainda está sendo processado; nesse caso, o painel pede que você tente novamente em instantes. Se o documento foi assinado ou recusado antes do cancelamento, o painel informa que ele mudou nesse meio-tempo. A Assinafy também pode recusar o cancelamento de documentos criados a partir de modelos; nesse caso, o painel pede que você cancele na Assinafy.
- Reenviar e cancelar exigem que a sua função no Twenty possa editar Documentos Assinafy; quem só pode lê-los recebe `FORBIDDEN`, com a mensagem "Sua função no Twenty não permite alterar este documento.", antes de qualquer chamada à Assinafy. Enviar exige que a sua função possa criar Documentos Assinafy; sem essa permissão, o envio responde `FORBIDDEN` com "Sua função no Twenty não permite criar Documentos Assinafy." antes de qualquer envio.
- **Remover do Twenty:** disponível em Falhou e em Confira na Assinafy quando não há documento da Assinafy para consultar. Move o registro para os Documentos Assinafy excluídos, de onde ele pode ser restaurado. Nada muda na Assinafy. Se a sua função no Twenty não puder excluir Documentos Assinafy, o painel mostra "Sua função no Twenty não permite alterar este documento.".

### Atualizações em segundo plano

A cada 15 minutos, o app atualiza os documentos em aberto (Aguardando assinaturas, Finalizando, Desconhecido e envios não confirmados) enviados, ou criados, no caso dos envios não confirmados, nos últimos 120 dias, até 50 por execução, começando pelos verificados há mais tempo, e guarda os PDFs assinados. Ele usa apenas a chave de API e as conexões compartilhadas com o workspace, cada uma para os documentos do workspace da Assinafy que ela acessa. Os documentos de um workspace da Assinafy que nenhuma delas acessa só são atualizados quando alguém os abre; a etapa de revisão avisa isso antes do envio.

### Chat de IA

No chat de IA do Twenty, peça ao assistente que prepare uma solicitação de assinatura para uma Pessoa, Empresa ou Oportunidade. Ele consulta os PDFs, os modelos, os contatos e os envios recentes do registro com `get-signature-context-tool`, e então `propose-signature-request` mostra um cartão com o fluxo de envio preenchido. Se a proposta for recusada (por exemplo, um anexo que não está no registro), o cartão mostra o motivo. Os signatários só podem ser pessoas do CRM, validadas por e-mail por padrão. O assistente não pode enviar arquivos, gerar cobranças nem enviar solicitações: você revisa o documento, os signatários e o custo da Assinafy no cartão e seleciona Enviar para assinatura. Pergunte ao assistente sobre uma solicitação existente e `get-assinafy-document-status` a atualiza e resume quem já assinou, com os mesmos estados de signatário do painel. Essa consulta nunca gera cobrança: ela só atualiza o registro no Twenty e guarda os PDFs assinados quando o documento está concluído.

### Fluxos de trabalho

No menu Workflows do Twenty, adicione a ação Enviar para assinatura (Assinafy) a um fluxo de trabalho. Ela usa somente a chave de API quando ela está preenchida e, sem ela, uma conexão compartilhada com o workspace (a primeira pelo nome), nunca a conexão própria de um membro, e não troca de credencial se a escolhida for recusada. Sem chave de API, a ação recusa com `ACCOUNT_REQUIRED` quando as conexões compartilhadas dão acesso a workspaces diferentes da Assinafy.

| Entrada | Observações |
| --- | --- |
| PDF anexado, ou ID do modelo da Assinafy (em vez de um PDF) | Exatamente um dos dois. O PDF precisa estar anexado ao registro vinculado. |
| Signatários | Registros de Pessoa, até 20. São usados o nome, o e-mail principal e o telefone principal de cada um. Para um modelo, informe uma pessoa por papel de signatário, na ordem dos papéis. |
| Oportunidade, Pessoa, Empresa | Pelo menos uma. O documento é vinculado à Oportunidade, se informada; senão, à Pessoa; senão, à Empresa. |
| Nome do documento | Por padrão, o nome do arquivo ou o nome de documento do modelo. |
| Mensagem para os signatários | Opcional. |
| Validação da assinatura | E-mail (padrão) ou WhatsApp. Todos os signatários usam essa validação e assinam em paralelo. |
| Prazo para assinar (dias) | Opcional, de 1 a 365. |
| Máximo de créditos (0 = somente documentos do plano) | Padrão: 0. A ação para com `COST_LIMIT_EXCEEDED` quando a estimativa de custo da Assinafy ultrapassa esse valor, arredondado para baixo em centavos (0,449 permite no máximo 0,44 crédito). Com 0, só é permitido um envio que use um documento do plano e nenhum crédito. |

Oportunidade, Pessoa, Empresa e PDF anexado aceitam o ID ou o próprio registro, assim como cada item de Signatários. Uma lista no lugar de um único registro, ou um objeto sem ID, é recusado com `INVALID_INPUT` (tipo inválido).

A ação retorna Enviado, ID do registro do Documento Assinafy, Status, Código do erro e Mensagem de erro: use Enviado para decidir o próximo passo. Deixe "Tentar novamente em caso de falha" desativado nesta ação: cada execução é um novo envio. A ação nunca começa a chamada cobrada se ela não puder terminar antes do tempo limite da função; nesse caso, retorna `PROVIDER_UNAVAILABLE` e nada é enviado. Se o mesmo documento (mesmo nome) já foi enviado para o mesmo registro nos últimos 3 minutos e esse envio não falhou, a ação retorna `UNCERTAIN` com esse registro, sem enviar de novo. Quando o envio não sai, o PDF que a ação carregou é excluído da Assinafy, na hora ou pela limpeza automática dos uploads não enviados; depois de um `UNCERTAIN`, o PDF é mantido.

Para agir quando um documento for assinado, crie em Workflows um fluxo de trabalho com o gatilho de registro atualizado do Twenty em Documentos Assinafy e continue apenas quando o Status for Assinado.

## Permissões e dados

**No Twenty**

- A função Assinafy do app pode ler Pessoas, Empresas, Oportunidades e Anexos, sem poder alterá-los nem excluí-los. Em Documentos Assinafy, pode ler, gravar e excluir registros, que podem ser restaurados, mas não pode excluí-los definitivamente. Pode enviar arquivos (os PDFs assinados) e não tem acesso às configurações nem a outras ferramentas.
- As ações iniciadas por um membro rodam com as permissões desse membro no Twenty combinadas com a função do app: ele só vê os registros, anexos e pessoas que tem permissão para ler, e o Documento Assinafy é criado em nome dele. Se o membro não tiver permissão para ler Pessoas, Empresas ou Oportunidades, o app continua funcionando com os objetos que esse membro pode ler. Quando a função do membro oculta apenas um campo (por exemplo, os telefones ou e-mails das pessoas, a empresa de uma pessoa, ou o contato principal ou a empresa de uma oportunidade), só esse campo fica vazio, e o registro ou o contato continua disponível. Enviar exige poder criar Documentos Assinafy, e a aba Assinaturas e o fluxo de envio leem os Documentos Assinafy do registro com as permissões do membro.
- As atualizações de status, o envio dos arquivos assinados, a tarefa em segundo plano e os fluxos de trabalho gravam com a função do app.
- Além dos registros de Documento Assinafy e das entradas que o Twenty adiciona à linha do tempo para eles, o app não grava nada no seu CRM. O cancelamento exclui a solicitação apenas na Assinafy; Remover do Twenty exclui o registro do Documento Assinafy, que pode ser restaurado.
- Desinstalar o app remove do Twenty o objeto Documentos Assinafy, com todos os registros e os PDFs assinados guardados neles, e remove as conexões locais, tentando revogar os tokens de acesso disponíveis. Revogue também o app em Aplicativos conectados na Assinafy para encerrar completamente as autorizações. As entradas que o app criou na linha do tempo dos registros continuam como histórico. Os documentos continuam na Assinafy, e as solicitações pendentes não são canceladas. Baixe os PDFs assinados de que precisar antes de desinstalar.

**Enviado à Assinafy**

- O PDF, enviado quando você seleciona Preparar e revisar, antes de qualquer convite.
- O nome do documento, a mensagem opcional e o prazo.
- Para cada signatário: nome completo, e-mail, o número de WhatsApp (apenas em convites por WhatsApp) e o CPF ou CNPJ (apenas para signatários com certificado). Os signatários são criados na lista de signatários do seu workspace da Assinafy ou localizados nela pelo e-mail; em um signatário localizado, o nome é atualizado, assim como o número de WhatsApp (em convites por WhatsApp) e o CPF ou CNPJ (para signatários com certificado). O e-mail nunca é alterado. Trocar o WhatsApp de um signatário que já existe na Assinafy invalida os links e códigos dos convites pendentes enviados ao número anterior; use Reenviar convite nesses documentos. A Assinafy recusa a troca enquanto o signatário tiver validado o número anterior em um documento ainda em assinatura.

**Guardado pelo app**

- O registro do Documento Assinafy. Detalhes dos signatários guarda, para cada signatário, o ID na Assinafy, o nome, o e-mail, o telefone, os métodos de validação e de convite, a etapa e o andamento. Nunca guarda links de assinatura nem números de CPF/CNPJ.
- No armazenamento de chave-valor do app: os IDs de uploads que nunca foram enviados para assinatura, com o membro que os preparou (até os 200 mais recentes), e os IDs das conexões compartilhadas. Um upload só é reaproveitado ou enviado pelo membro que o preparou e por até 23 horas; depois disso, a revisão carrega o PDF de novo. Os uploads não enviados são excluídos da Assinafy quando você sai do fluxo ou troca o arquivo ou o nome dele; só o membro que preparou um upload pode descartá-lo. Os que sobrarem, inclusive os de envios que terminaram em Falhou, são excluídos pela tarefa em segundo plano após 24 horas, quando a chave de API ou uma conexão compartilhada acessa o workspace da Assinafy deles e a Assinafy ainda os informa como não enviados, ou como uploads cujo processamento falhou e que nunca foram atribuídos. Se a Assinafy ainda estiver processando o arquivo, a tarefa tenta de novo nas execuções seguintes, por até 7 dias. Os que nenhuma chave de API ou conexão compartilhada acessa, ou que não puderam ser excluídos em 7 dias, ficam na Assinafy e deixam de ser acompanhados pelo app. A exclusão automática cobre os uploads que o app acompanha (até 200 por vez). Nenhum upload é excluído enquanto um Documento Assinafy que não terminou em Falhou apontar para ele.
- Os tokens OAuth são guardados pelo Twenty, nunca pelo app. Tokens, chaves de API, links de assinatura e corpos de resposta da Assinafy nunca são registrados em log; as mensagens da Assinafy e o motivo de uma recusa são exibidos e guardados com links, e-mails e números longos substituídos por [link], [e-mail] e [número], com até 300 caracteres.

**LGPD:** os dados dos signatários que você envia são tratados pela Assinafy, que atua como operadora nos termos de uso dela. Veja a política de privacidade da Assinafy em https://www.assinafy.com.br/politica-de-privacidade.

## Limitações

- O app não usa webhooks da Assinafy. Os status vêm da atualização em segundo plano a cada 15 minutos, da abertura de um documento e de Atualizar.
- O painel não envia arquivos do seu computador. Anexe primeiro o PDF na aba Arquivos do registro.
- Modelos com campos a preencher (campos de editor) não podem ser enviados por fluxos de trabalho. Os fluxos de trabalho também enviam apenas com validação por E-mail ou WhatsApp, em paralelo.
- Um signatário por WhatsApp sem e-mail ganha um novo perfil de signatário na Assinafy a cada envio, porque a Assinafy localiza signatários existentes pelo e-mail.
- Enviar com um novo número de WhatsApp para um signatário que já existe na Assinafy atualiza o número dele e invalida os convites pendentes enviados ao número anterior; use Reenviar convite nesses documentos.
- Os PDFs são enviados com o método de assinatura virtual da Assinafy, sem campos de assinatura posicionados nas páginas. Para posicionar campos, prepare um modelo na Assinafy.
- Limites: 25 MB por PDF, 20 signatários por solicitação, 50 campos de modelo para preencher, os 50 anexos mais recentes de um registro, até 10 outras pessoas da empresa relacionada em Preencher com um contato (as cadastradas primeiro) e os 200 primeiros modelos do workspace da Assinafy. A aba Assinaturas mostra os 50 Documentos Assinafy mais recentes do registro; os demais aparecem na visualização Documentos Assinafy.
- A atualização em segundo plano cobre documentos enviados nos últimos 120 dias; os mais antigos são atualizados quando abertos.
- O Twenty 2.42 renova os tokens OAuth sem impedir renovações simultâneas, e a Assinafy encerra a autorização quando o mesmo token de renovação é usado duas vezes. Por isso, duas chamadas ao mesmo tempo com uma conexão cujo token tem mais de 55 minutos podem encerrar a conexão; nesse caso, reconecte pela aba Geral.
- No Twenty 2.42, um navegador que estava com o Twenty aberto enquanto o app era instalado ou reinstalado guarda os novos widgets de forma incompleta e mostra "No Data" na aba Assinaturas e no widget Status da assinatura, mesmo depois de recarregar a página. Limpe os dados do site do Twenty no navegador e entre novamente; uma sessão nova, como uma janela anônima, já mostra a aba normalmente.
- Logo depois da desinstalação, páginas de registro que estavam abertas podem mostrar um erro do Twenty até serem recarregadas.

## Solução de problemas

### Mensagens nos painéis

| Código | Mensagem (resumo) | Causa e solução |
| --- | --- | --- |
| `NOT_CONNECTED` | Conecte a Assinafy ou peça a um administrador para configurar uma chave de API. Uma conexão expira depois de 30 dias sem uso. | Não há conexão nem chave de API utilizável. Adicione uma conexão na aba Geral ou configure a chave de API. Os fluxos de trabalho precisam da chave de API ou de uma conexão compartilhada. |
| `RECONNECT_REQUIRED` | A Assinafy recusou as credenciais. | A autorização OAuth expirou (30 dias sem uso) ou foi revogada na Assinafy, ou a chave de API foi excluída. Reconecte ou salve uma nova chave de API. Nos fluxos de trabalho, a chave de API é usada sempre que está preenchida: salve uma chave válida ou apague-a para usar a conexão compartilhada. |
| `INSUFFICIENT_SCOPE` | Reconecte a Assinafy e conceda a permissão. | Falta uma permissão na conexão. Reconecte e aprove todas as permissões; se a Assinafy não oferecer a permissão, adicione-a à aplicação OAuth da Assinafy. |
| `FORBIDDEN` | Sua conexão com a Assinafy não tem acesso a este documento ou workspace. | O documento pertence a um workspace da Assinafy que nenhuma credencial disponível acessa, ou a chave de API não tem acesso ao workspace configurado. Conecte um usuário desse workspace ou corrija `ASSINAFY_ACCOUNT_ID`. A Assinafy também pode recusar WhatsApp ou certificado digital quando o plano não inclui o recurso; confira o plano do workspace. Ao reenviar, cancelar ou remover, a mensagem "Sua função no Twenty não permite alterar este documento." indica que a sua função no Twenty não pode editar (ou excluir) Documentos Assinafy. Ao enviar, "Sua função no Twenty não permite criar Documentos Assinafy." indica que ela não pode criá-los; nada foi enviado. |
| `ACCOUNT_REQUIRED` | A chave de API acessa vários workspaces da Assinafy, ou, num fluxo de trabalho sem chave de API, as conexões compartilhadas com o workspace dão acesso a workspaces diferentes da Assinafy. | Chave de API: preencha o ID do workspace na Assinafy (`ASSINAFY_ACCOUNT_ID`). Fluxo de trabalho sem chave de API: defina a chave de API da Assinafy ou mantenha conexões compartilhadas com um único workspace da Assinafy. |
| `NOT_FOUND` | Este registro ou arquivo não está mais disponível. | O registro ou o anexo foi removido, ou o documento foi excluído na Assinafy. |
| `RATE_LIMITED` | A Assinafy está recebendo muitas solicitações. | Aguarde um momento e tente novamente. |
| `PROVIDER_REJECTED` | A Assinafy recusou a solicitação: motivo. | A Assinafy recusou os dados ou a ação. O motivo aparece depois de "A Assinafy recusou a solicitação:" somente quando a própria Assinafy o informa; sem ele, a mensagem é "A Assinafy recusou o documento ou os dados dos signatários.". As orientações do próprio app (por exemplo, um documento ainda em processamento, um documento criado a partir de um modelo ou um convite que não foi reenviado) aparecem como estão escritas. Corrija os dados ou siga a orientação. |
| `PROVIDER_UNAVAILABLE` | A Assinafy está indisponível no momento. | A Assinafy não respondeu. Nada foi enviado. Tente novamente em alguns minutos. Quando quem não respondeu foi o Twenty (ao listar as conexões ou baixar o anexo), a mensagem é "O Twenty não respondeu. Tente novamente em instantes.". Num fluxo de trabalho, também indica que não havia tempo para concluir o envio na execução. |
| `UNCERTAIN` | Confira o envio na Assinafy: a solicitação pode ter sido recebida. | O envio ou o reenvio excedeu o tempo limite ou falhou do lado da Assinafy, ou a resposta do reenvio confirmado não chegou ao painel. Num envio, o documento aparece como Confira na Assinafy e o fluxo oferece Abrir documento; num reenvio, o status não muda. Não envie nem reenvie de novo antes de conferir na Assinafy. |
| `COST_CHANGED` | O custo mudou desde a sua revisão. | O custo mudou entre a revisão e o envio. Confira a nova estimativa e confirme novamente. |
| `INSUFFICIENT_RESOURCES` | Pagamento pendente, documentos do plano esgotados ou créditos insuficientes. | Regularize o pagamento ou adicione documentos ou créditos na Assinafy e revise novamente. |
| `COST_LIMIT_EXCEEDED` | O custo ultrapassa o limite de créditos permitido. | Apenas em fluxos de trabalho: aumente o Máximo de créditos ou use um método de validação mais barato. |
| `INVALID_STATE` | Este documento mudou nesse meio-tempo. | O status do documento mudou, o PDF enviado já foi usado na Assinafy ou o workspace da Assinafy mudou desde a revisão. Revise novamente. |
| `INVALID_INPUT` | Uma mensagem específica do campo. | Corrija o campo indicado, como um e-mail ausente ou um WhatsApp sem o código do país. Quando o modelo mudou na Assinafy depois que o envio foi aberto (papéis de signatário ou campos incluídos ou removidos, ou o modelo excluído ou não mais pronto), a mensagem é "O modelo foi alterado na Assinafy depois que você abriu o envio. Feche e abra o envio de novo para usar a versão atual.". Um modelo com mais de 20 papéis de signatário ou mais de 50 campos para preencher não pode ser enviado pelo Twenty. |
| `NOT_SENT` | A Assinafy confirmou que a tentativa anterior não foi enviada. Confirme e envie novamente. | Um envio repetido na mesma solicitação encontrou um registro que a atualização em segundo plano marcou como não enviado. Confirme e envie de novo. |
| `INTERNAL` | Algo deu errado. | Resposta inesperada. Tente novamente; uma nova tentativa de envio feita no mesmo fluxo reaproveita a mesma solicitação. |

O campo Último erro de um Documento Assinafy guarda o código da última operação com falha. Um documento em status final (Assinado, Recusado, Cancelado ou Falhou) mantém o código que tinha: uma atualização que falha depois não o substitui, e um documento em Falhou não é mais consultado na Assinafy, então o motivo da falha continua visível. Além dos códigos acima: `SIGNED_FILES_PENDING` indica que todos assinaram e o PDF assinado ainda está sendo copiado; `NOT_SENT` indica que a Assinafy confirmou que a solicitação nunca foi enviada; `NO_CREDENTIAL` indica que a tarefa em segundo plano não tem uma credencial que acesse o workspace da Assinafy do documento; nesse caso, compartilhe uma conexão com esse workspace ou configure uma chave de API para ele.

### Conexão com OAuth

- **Adicionar conexão está desativado e a aba Geral diz que é preciso um administrador do servidor:** `ASSINAFY_CLIENT_ID` e `ASSINAFY_CLIENT_SECRET` não estão preenchidas. Preencha-as ou use uma chave de API.
- **A Assinafy mostra um erro na própria página e nunca volta ao Twenty:** o ID do cliente está errado ou a aplicação OAuth da Assinafy não tem exatamente a URI de redirecionamento `<SERVER_URL>/auth/apps/callback`.
- **O Twenty mostra "OAuth provider returned error":** `access_denied` significa que a aprovação foi recusada; `invalid_scope` significa que a aplicação OAuth da Assinafy não está registrada com as seis permissões.
- **A troca do token falha depois da aprovação:** o segredo do cliente está errado ou foi trocado, ou a aplicação está desativada na Assinafy. Atualize `ASSINAFY_CLIENT_SECRET`.
- **Estado inválido depois da aprovação:** a aprovação levou mais de 10 minutos. Comece de novo em Adicionar conexão.
- **A conexão pede reconexão:** a conexão ficou 30 dias sem uso, ou a autorização foi revogada na Assinafy em Aplicativos conectados. Reconecte.

### Avisos da verificação de saúde

| Aviso | Solução |
| --- | --- |
| A Assinafy não está conectada ao workspace | Não há chave de API nem conexão compartilhada com o workspace: os status só são atualizados quando alguém abre um documento. Adicione uma conexão compartilhada ou configure uma chave de API. |
| A chave de API da Assinafy foi recusada | Crie uma nova chave de API na Assinafy e salve-a na aba Variáveis. |
| Uma conexão compartilhada com a Assinafy foi recusada | A autorização expirou ou foi revogada na Assinafy. Reconecte-a na aba Geral. |
| … não tem todas as permissões necessárias | Chave de API: crie na Assinafy uma chave de API com acesso a documentos e modelos e salve-a na aba Variáveis. Conexão: reconecte-a na aba Geral e aprove todas as permissões solicitadas. |
| … não tem acesso ao workspace | Chave de API: confira o ID do workspace na Assinafy na aba Variáveis ou use a chave de um usuário com acesso a esse workspace. Conexão: reconecte-a na aba Geral com um usuário da Assinafy que tenha acesso ao workspace. |
| A chave de API da Assinafy acessa vários workspaces | Preencha o ID do workspace na Assinafy na aba Variáveis. |

Uma indisponibilidade temporária da Assinafy não gera aviso.

## Suporte

- Problemas e sugestões: https://github.com/assinafy/twenty-crm-app/issues
- Site: https://www.assinafy.com.br
- Contato: https://www.assinafy.com.br/contato
- Termos de uso: https://www.assinafy.com.br/termos-de-uso
- Política de privacidade: https://www.assinafy.com.br/politica-de-privacidade
- Guia para desenvolvedores (em inglês): https://github.com/assinafy/twenty-crm-app/blob/main/SETUP.md
