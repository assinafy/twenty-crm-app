# Histórico de alterações

Todas as alterações relevantes deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e este projeto adota o
[Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/assinafy/twenty-crm-app/releases/tag/v1.0.0
