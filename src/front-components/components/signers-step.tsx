import { type Dispatch } from 'react';
import { useTranslate } from 'twenty-sdk/front-component';
import { Callout } from 'twenty-ui/components';
import { Button } from 'twenty-ui/primitives/input';

import { MAX_SIGNERS } from 'src/constants/limits';
import { CheckboxInput } from 'src/front-components/components/checkbox-input';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { SignerCard } from 'src/front-components/components/signer-card';
import { type SendFlowAction } from 'src/types/send-flow-action';
import { type SendFlowState } from 'src/types/send-flow-state';
import { requiresSigningOrder } from 'src/utils/requires-signing-order.util';

type SignersStepProps = {
  state: SendFlowState;
  dispatch: Dispatch<SendFlowAction>;
  onPrepare: () => void;
};

export const SignersStep = ({ state, dispatch, onPrepare }: SignersStepProps) => {
  const { t } = useTranslate();
  const { draft, context } = state;
  const pdf = draft.sourceType === 'PDF';
  const roles = context.templates.find((template) => template.id === draft.templateId)?.signerRoles ?? [];
  const contacts = [...context.suggestedSigners, ...context.additionalContacts];
  const hasCertificate = requiresSigningOrder(draft.signers);

  return (
    <div style={FIELD_STYLES.stack}>
      {draft.signers.map((signer, index) => (
        <SignerCard
          key={signer.roleId ?? index}
          signer={signer}
          index={index}
          roleName={pdf ? null : (roles.find((role) => role.id === signer.roleId)?.name ?? null)}
          contacts={contacts}
          removable={pdf && draft.signers.length > 1}
          disabled={state.preparing}
          dispatch={dispatch}
        />
      ))}
      {pdf && draft.signers.length < MAX_SIGNERS ? (
        <div style={FIELD_STYLES.row}>
          <Button
            variant="outline"
            size="sm"
            disabled={state.preparing}
            onClick={() => dispatch({ type: 'ADD_SIGNER' })}
          >
            {t('Adicionar signatário')}
          </Button>
        </div>
      ) : null}
      <CheckboxInput
        label={t('Assinar um por vez, na ordem da lista')}
        checked={draft.sequential || hasCertificate}
        disabled={hasCertificate || state.preparing}
        onToggle={() => dispatch({ type: 'TOGGLE_SEQUENTIAL' })}
        hint={
          hasCertificate
            ? t('Obrigatório com certificado digital, para que cada titular de certificado assine em sua própria etapa.')
            : undefined
        }
      />
      {draft.signers.some((signer) => signer.notificationMethod === 'Whatsapp') ? (
        <Callout
          variant="warning"
          title={t('Sobre convites por WhatsApp')}
          description={t(
            'Se um signatário já estiver cadastrado na Assinafy com outro número, o número será atualizado e os convites pendentes dele em outros documentos precisarão ser reenviados pela Assinafy.',
          )}
          fullWidth
        />
      ) : null}
      <p style={FIELD_STYLES.muted}>
        {t('O documento e os signatários serão preparados na Assinafy. Nenhum convite é enviado nesta etapa.')}
      </p>
      {state.error ? <ErrorCallout error={state.error} /> : null}
      <div style={FIELD_STYLES.row}>
        <Button
          variant="outline"
          disabled={state.preparing}
          onClick={() => dispatch({ type: 'GO_TO', step: 'DOCUMENT' })}
        >
          {t('Voltar ao documento')}
        </Button>
        <Button color="accent" loading={state.preparing} disabled={state.preparing} onClick={onPrepare}>
          {t('Preparar e revisar')}
        </Button>
      </div>
    </div>
  );
};
