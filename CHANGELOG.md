# Histórico de alterações

Todas as alterações relevantes deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e este projeto adota o
[Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

## [1.4.1] - 2026-10-28

### Corrigido

- Verificação de tipos em instalações novas, antes da geração do cliente do Twenty.

## [1.4.0] - 2026-10-28

### Adicionado

- Gestão de contratos no painel do Documento Assinafy: contraparte, valor, moeda, vigência, renovação automática e
  antecedência dos avisos; renovação e encerramento com confirmação e consulta do andamento de aditivos.
- Status, termos e última verificação do contrato no Twenty, com campos gravados somente pelo app e proteção contra
  alterações concorrentes. Os termos não modificam o PDF nem solicitam novas assinaturas.
- Acompanhamento dos oito eventos de contrato por webhooks autenticados e atualização periódica dos contratos
  acompanhados, inclusive depois da conclusão das assinaturas.

### Corrigido

- Documentos com biometria em análise podem ser cancelados pelo painel.
- Falhas de processamento depois de um envio confirmado continuam sendo acompanhadas e podem recuperar os PDFs
  assinados quando a Assinafy concluir o processamento, incluindo registros de versões anteriores.
- Descartar um upload recente mantém o PDF na fila de limpeza por 24 horas; o descarte não exclui um arquivo enquanto
  um envio ainda pode começar. A limpeza de uploads próprios de fluxos de trabalho com falha definitiva continua imediata.
- A orientação de um documento com falha deixa de afirmar que os convites nunca chegaram aos signatários.

### Alterado

- Atualização do `@assinafy/sdk` para 2.9.1 e adoção de Node.js 26 LTS no desenvolvimento e na integração contínua,
  mantendo compatibilidade com Node.js 24 LTS.
- Atualização de dependências de transporte HTTP, validação, geração de arquivos e testes.

## [1.3.1] - 2026-10-19

### Corrigido

- Solicitações com certificado digital passam a usar somente PDFs e solicitações virtuais. Modelos com certificado
  são recusados antes da estimativa ou do envio, evitando um convite cobrado que não poderia ser assinado.
- Atualização do `@assinafy/sdk` para a versão 2.8.1.

## [1.3.0] - 2026-10-16

### Adicionado

- Validação por biometria facial e documento de identidade, com CPF válido e convite por e-mail ou WhatsApp.
- Status Biometria em análise e acompanhamento da aprovação ou recusa na Assinafy antes da finalização do documento.
- Atualizações por webhook para os eventos de verificação de identidade e análise da biometria.

### Alterado

- Endpoints de webhook criados por OAuth também recebem e validam assinaturas Standard Webhooks. Endpoints OAuth
  antigos sem assinatura são substituídos automaticamente na próxima atualização em segundo plano.
- Atualização do `@assinafy/sdk` para a versão 2.8.0.

## [1.2.0] - 2026-10-07

### Adicionado

- Webhooks opcionais da Assinafy: com o E-mail dos webhooks da Assinafy preenchido, o app registra um endpoint em cada
  workspace da Assinafy acessado pela chave de API ou por uma conexão compartilhada e atualiza o documento assim que
  a Assinafy avisa uma assinatura, recusa, cancelamento, conclusão ou falha de processamento. Endpoints registrados
  com a chave de API são assinados, e cada entrega tem a assinatura conferida. A atualização a cada 15 minutos continua
  funcionando.
- A verificação de saúde avisa quando os webhooks estão ativados, mas o endpoint ainda não foi registrado.

### Alterado

- A conexão OAuth solicita também a permissão `webhooks:write`. Conexões existentes continuam enviando; reconecte-as
  para que possam registrar os webhooks.
- Desinstalar o app remove o endpoint de webhook que ele registrou.
- Atualização do `@assinafy/sdk` para a versão 2.6.0.

## [1.1.0] - 2026-10-07

### Adicionado

- Signatários com certificado digital aceitam o CNPJ alfanumérico (14 caracteres, com letras nos 12 primeiros).
- A aba Assinaturas e o painel do Documento Assinafy explicam quando a função do membro no Twenty não permite ver
  Documentos Assinafy.

### Alterado

- Um envio sem confirmação da Assinafy aparece como aviso, com o título "Confira na Assinafy antes de enviar de novo".
- Atualização do `@assinafy/sdk` para a versão 2.5.2.

### Corrigido

- O envio feito por um membro não inicia a chamada cobrada quando ela não teria tempo de terminar antes do limite de
  execução; nada é enviado e o registro termina como falha.
- Mensagens da Assinafy ocultam CNPJs alfanuméricos.

## [1.0.1] - 2026-10-05

### Corrigido

- Estimativas com custos negativos ou quantidades de documentos fracionárias, negativas ou fora da precisão segura são recusadas antes de um envio ou reenvio.
- O reenvio de convites sempre mostra o custo e pede confirmação, inclusive quando não consome créditos.

## [1.0.0] - 2026-09-25

### Adicionado

- Comando Enviar para assinatura nos registros de Pessoa, Empresa e Oportunidade, e uma aba Assinaturas nas páginas
  desses registros, com os Documentos Assinafy de cada registro, o status, o andamento e o download dos arquivos
  assinados.
- Fluxo de envio em três etapas (Documento, Signatários e Revisar e enviar) para um PDF anexado ao registro ou um
  modelo pronto da Assinafy (até 20 papéis de signatário e 50 campos para preencher), com campos do modelo, nome do
  documento, mensagem para os signatários e prazo para assinar.
- Validação dos signatários por e-mail, WhatsApp ou Certificado digital ICP-Brasil (A1 ou A3), com signatários
  preenchidos a partir dos contatos do CRM, até 20 signatários por PDF e ordem de assinatura opcional (obrigatória com
  certificado).
- Estimativa de custo da Assinafy em tempo real, com documentos do plano, créditos, saldo e motivos de bloqueio,
  confirmação explícita e nova conferência do custo logo antes do envio.
- Aviso na etapa de revisão quando o registro tem envios da última hora que podem ter chegado aos signatários, com a
  confirmação de que eles foram conferidos antes de um novo envio.
- Objeto Documento Assinafy com uma visualização própria, um item no menu de navegação e um painel Status da
  assinatura que mostra o andamento dos signatários, as datas e as ações que cada status permite.
- Acompanhamento do andamento de cada signatário e do status, de Enviando até Assinado, Recusado, Cancelado, Expirado,
  Falhou e Confira na Assinafy, com resolução automática dos envios de PDF não confirmados.
- PDF assinado e, quando houver certificado digital, PDF com certificado ICP-Brasil guardados no campo Documento
  assinado.
- Reenvio de convite com confirmação do custo, cancelamento de uma solicitação pendente e remoção do Twenty de
  documentos com falha ou não confirmados.
- Atualização em segundo plano dos documentos em aberto a cada 15 minutos e limpeza dos uploads não enviados após 24
  horas.
- Conexão OAuth com a Assinafy usando PKCE, com revogação ao desconectar e ao desinstalar, ou chave de API da Assinafy
  com ID do workspace na Assinafy opcional. Uma conexão OAuth continua ativa enquanto é usada e expira depois de 30 dias
  sem uso; o app marca para reconexão as conexões expiradas ou revogadas.
- Avisos da verificação de saúde na página de configurações do app para credenciais ausentes, recusadas ou mal
  configuradas.
- Ferramentas para o chat de IA que consultam o que pode ser enviado, propõem uma solicitação de assinatura em um
  cartão que o membro revisa e envia, e informam o status de um documento.
- Ação de fluxo de trabalho Enviar para assinatura (Assinafy) com limite máximo de créditos. Ela nunca começa a chamada
  cobrada sem tempo para concluí-la dentro da execução e retorna `UNCERTAIN`, sem enviar de novo, quando o mesmo
  documento foi enviado para o mesmo registro nos últimos minutos.
- Entradas na linha do tempo da Pessoa, Empresa ou Oportunidade vinculada quando uma solicitação de assinatura é
  criada.
- Interface em português do Brasil.

[1.4.1]: https://github.com/assinafy/twenty-crm-app/releases/tag/v1.4.1
[1.4.0]: https://github.com/assinafy/twenty-crm-app/releases/tag/v1.4.0
[1.3.1]: https://github.com/assinafy/twenty-crm-app/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/assinafy/twenty-crm-app/releases/tag/v1.3.0
[1.2.0]: https://github.com/assinafy/twenty-crm-app/releases/tag/v1.2.0
[1.1.0]: https://github.com/assinafy/twenty-crm-app/releases/tag/v1.1.0
[1.0.1]: https://github.com/assinafy/twenty-crm-app/releases/tag/v1.0.1
[1.0.0]: https://github.com/assinafy/twenty-crm-app/releases/tag/v1.0.0
