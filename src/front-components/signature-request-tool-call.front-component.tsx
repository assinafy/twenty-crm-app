import { defineFrontComponent } from 'twenty-sdk/define';
import { useToolCall, useTranslate } from 'twenty-sdk/front-component';
import { Callout } from 'twenty-ui/components';
import { Loader } from 'twenty-ui/primitives/feedback';

import { SIGNATURE_REQUEST_TOOL_CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { SendFlow } from 'src/front-components/components/send-flow';
import { parseToolCallProposal } from 'src/front-components/utils/parse-tool-call-proposal.util';

// Renders a propose-signature-request call as the send flow, prefilled. Only the user's own click sends it.
const SignatureRequestToolCall = () => {
  const { t } = useTranslate();
  const toolCall = useToolCall();

  if (toolCall === null) {
    return null;
  }

  if (toolCall.status === 'output-error' || toolCall.status === 'output-denied') {
    return (
      <div role="alert" style={FIELD_STYLES.container}>
        <Callout
          variant="error"
          title={t('Não foi possível continuar')}
          description={t('O assistente não conseguiu preparar esta solicitação de assinatura.')}
          fullWidth
        />
      </div>
    );
  }

  if (toolCall.status !== 'output-available') {
    return (
      <div role="status" style={{ ...FIELD_STYLES.container, ...FIELD_STYLES.row }}>
        <Loader />
        <p style={FIELD_STYLES.muted}>{t('Preparando uma solicitação de assinatura…')}</p>
      </div>
    );
  }

  const parsed = parseToolCallProposal(toolCall.output);

  return (
    <div style={FIELD_STYLES.container}>
      {parsed.ok ? (
        <>
          <p style={FIELD_STYLES.muted}>
            {t('Revise esta proposta. Nada é enviado até você confirmar o custo e selecionar Enviar para assinatura.')}
          </p>
          <SendFlow recordId={parsed.proposal.recordId} proposal={parsed.proposal} />
        </>
      ) : (
        <ErrorCallout error={parsed.error} />
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: SIGNATURE_REQUEST_TOOL_CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'signature-request-tool-call',
  description: 'Mostra uma solicitação de assinatura proposta pelo assistente de IA para o usuário revisar e enviar.',
  component: SignatureRequestToolCall,
});
