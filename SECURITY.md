# Política de segurança

## Versões com suporte

As correções de segurança são lançadas para a versão 1.x mais recente de `@assinafy/twenty-app`. Atualize para a
versão mais nova antes de relatar um problema encontrado em uma versão anterior. Os workspaces com a atualização
automática ativada na aba Geral do app recebem as novas versões automaticamente.

| Versão | Suporte |
| --- | --- |
| 1.x (mais recente) | Sim |
| Versões anteriores | Não |

## Como relatar uma vulnerabilidade

Relate vulnerabilidades de forma privada, nunca em uma issue pública:

- Use o relato privado de vulnerabilidades do GitHub: abra a aba Security de https://github.com/assinafy/twenty-crm-app e
  selecione Report a vulnerability.
- Ou entre em contato com a Assinafy em https://www.assinafy.com.br/contato e peça para falar com a equipe de
  segurança.

Informe a versão afetada, a versão do Twenty, os passos para reproduzir e o impacto. Não inclua tokens, chaves de API,
links de assinatura ou dados pessoais reais; descreva-os.

Relate vulnerabilidades do próprio Twenty ao projeto Twenty, e vulnerabilidades da plataforma Assinafy (e não deste
app) pela página de contato da Assinafy.

## Modelo de segurança

- **Credenciais:** os tokens OAuth são obtidos pelo Twenty com PKCE e guardados pelo Twenty; o app os lê a cada chamada
  e nunca os armazena. O segredo do cliente OAuth (`ASSINAFY_CLIENT_SECRET`) e a chave de API da Assinafy
  (`ASSINAFY_API_KEY`) são variáveis secretas, injetadas apenas nas funções lógicas e nunca enviadas ao navegador. Remover
  uma conexão revoga a autorização dela na Assinafy, mesmo que ela esteja marcada para reconexão, e desinstalar o app
  revoga todas as autorizações do workspace. As funções de ciclo de vida ignoram execuções iniciadas por um membro
  (por exemplo, pela API ou por um fluxo de trabalho iniciado manualmente). Um fluxo de trabalho disparado por evento,
  agendamento ou webhook roda sem membro e, se apontado para essas funções, pode revogar autorizações; limite a permissão
  Workflows a quem administra o workspace. Remover do Twenty o membro que adicionou uma conexão encerra essa conexão
  e apaga os tokens dela no Twenty, mas não revoga a autorização na Assinafy; revogue-a em Aplicativos conectados.
- **Identidade de quem envia:** um envio usa uma única credencial, escolhida antes de qualquer chamada à Assinafy, e
  nunca recorre a outra. Se o Twenty não conseguir listar as conexões, a chamada falha em vez de passar para a chave de
  API. Os fluxos de trabalho e as tarefas em segundo plano usam apenas a chave de API e as conexões compartilhadas com o
  workspace, nunca a conexão pessoal de um membro; um fluxo de trabalho envia só com a chave de API quando ela está
  preenchida e recusa o envio quando as conexões compartilhadas dão acesso a workspaces diferentes da Assinafy.
- **Privilégio mínimo no Twenty:** a função do app lê Pessoas, Empresas, Oportunidades e Anexos sem poder alterá-los
  nem excluí-los, gerencia apenas os próprios registros de Documento Assinafy (sem exclusão definitiva), pode enviar os
  PDFs assinados e não tem acesso às configurações nem a outras ferramentas. As ações de um membro rodam com as
  permissões do próprio membro combinadas com essa função. Enviar exige que o membro possa criar Documentos Assinafy, e
  reenviar e cancelar conferem, antes de qualquer chamada à Assinafy, se ele pode editar o Documento Assinafy.
- **Campos exclusivos do app:** todos os campos do objeto Documento Assinafy, exceto Nome, só podem ser gravados pelo
  app, então os membros não conseguem forjar status, IDs da Assinafy ou arquivos assinados. Não é possível criar
  registros pela interface.
- **Nenhuma superfície de entrada:** o app não registra webhooks nem rotas públicas ou de servidor. As rotas aceitam
  apenas requisições `POST` de membros do workspace autenticados, validam rigorosamente cada entrada e respondem com
  códigos de erro estáveis; quando a Assinafy recusa uma solicitação, apenas a mensagem dela é repassada, com links,
  e-mails e números longos ocultados.
- **Chamadas de saída:** apenas para os endpoints de produção da Assinafy, por HTTPS. Os anexos são baixados apenas
  de URLs `http(s)` que o Twenty devolve para os anexos do próprio registro, com tempo limite de 30 s e limite de 25 MB
  aplicado durante o download, e precisam ser PDFs.
- **Operações cobradas:** a estimativa de custo é confirmada pelo membro (ou limitada pelo máximo de créditos do
  fluxo de trabalho) e conferida novamente logo antes do envio, e uma operação cobrada nunca é repetida. Um ID de envio
  único faz com que um envio repetido devolva o documento existente. Um fluxo de trabalho nunca começa a chamada cobrada
  sem tempo para concluí-la, e uma execução que encontra um envio igual e recente do mesmo documento para o mesmo
  registro não envia de novo.
- **Minimização de dados:** o Twenty guarda o andamento dos signatários sem links de assinatura nem números de CPF/CNPJ.
  Os uploads não enviados são excluídos da Assinafy quando o membro sai do fluxo ou troca o arquivo ou, após 24 horas,
  pela tarefa em segundo plano, se a chave de API ou uma conexão compartilhada acessa o workspace da Assinafy deles. Os
  que nenhuma delas acessa, os que não puderam ser excluídos em 7 dias e os que o app deixou de acompanhar (ele acompanha
  até 200 por vez) ficam na Assinafy. Um upload só é excluído quando a Assinafy o informa como não enviado (ou como um
  upload com falha no processamento, nunca atribuído) e nenhum Documento Assinafy, exceto um que terminou em Falhou,
  aponta para ele; só o membro que preparou um upload pode reaproveitá-lo, enviá-lo ou descartá-lo. As mensagens da
  Assinafy e o motivo de uma recusa são exibidos e guardados com links, endereços de e-mail e números longos
  substituídos por [link], [e-mail] e [número], com até 300 caracteres; o texto completo do motivo continua na
  Assinafy.
- **Logs:** os logs registram apenas o nome da operação, um código de erro e o nome do erro. Tokens, chaves, segredos,
  links de assinatura, corpos de resposta da Assinafy e dados de contato dos signatários nunca são registrados; os
  testes unitários falham se uma credencial de teste chegar ao console.
