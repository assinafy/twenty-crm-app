import { type Dispatch, useState } from 'react';
import { useTranslate } from 'twenty-sdk/front-component';
import { Callout } from 'twenty-ui/components';
import { Button } from 'twenty-ui/primitives/input';

import { CheckboxInput } from 'src/front-components/components/checkbox-input';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { StatusTag } from 'src/front-components/components/status-tag';
import { buildSignatureRequestInput } from 'src/front-components/utils/build-signature-request-input.util';
import { describeEstimate } from 'src/front-components/utils/describe-estimate.util';
import { getMethodLabel } from 'src/front-components/utils/get-method-label.util';
import { isSendBlockedByRecentSends } from 'src/front-components/utils/is-send-blocked-by-recent-sends.util';
import { type SendFlowAction } from 'src/types/send-flow-action';
import { type SendFlowState } from 'src/types/send-flow-state';
import { formatDate } from 'src/utils/format-date.util';

type ReviewStepProps = {
  state: SendFlowState;
  dispatch: Dispatch<SendFlowAction>;
  onSend: () => void;
  onPrepareAgain: () => void;
};

export const ReviewStep = ({ state, dispatch, onSend, onPrepareAgain }: ReviewStepProps) => {
  const { t } = useTranslate();
  const { prepared, draft, context } = state;
  const [recentSendsChecked, setRecentSendsChecked] = useState(false);

  if (prepared === null) {
    return null;
  }

  const lines = describeEstimate(prepared.estimate);
  const input = buildSignatureRequestInput(draft, context.record.id, null);
  const deadline = formatDate(input.expiresAt);
  const sourceName =
    draft.sourceType === 'PDF'
      ? context.attachments.find((attachment) => attachment.id === draft.attachmentId)?.name
      : context.templates.find((template) => template.id === draft.templateId)?.name;
  const sending = state.step === 'SENDING';
  const busy = sending || state.preparing;
  // Set outside SENDING only after a send without a known outcome; the reducer then ignores edits.
  const retryPending = !sending && state.requestId !== null;

  return (
    <div style={FIELD_STYLES.stack}>
      <div style={FIELD_STYLES.card}>
        <p style={FIELD_STYLES.label}>{t('Workspace da Assinafy')}</p>
        <p style={FIELD_STYLES.text}>{prepared.accountName}</p>
        <p style={FIELD_STYLES.label}>{t('Documento')}</p>
        <p style={FIELD_STYLES.text}>{input.name}</p>
        {sourceName ? (
          <p style={FIELD_STYLES.muted}>
            {draft.sourceType === 'PDF'
              ? t('Arquivo: {name}', { name: sourceName })
              : t('Modelo: {name}', { name: sourceName })}
          </p>
        ) : null}
        {deadline ? <p style={FIELD_STYLES.muted}>{t('Prazo para assinar: {date}', { date: deadline })}</p> : null}
      </div>
      <div style={FIELD_STYLES.card}>
        <p style={FIELD_STYLES.label}>{t('Signatários')}</p>
        <ol style={{ ...FIELD_STYLES.stack, margin: 0, paddingLeft: 'var(--t-spacing-4)' }}>
          {input.signers.map((signer, index) => (
            <li key={signer.roleId ?? index}>
              <p style={FIELD_STYLES.text}>{signer.name}</p>
              <p style={FIELD_STYLES.muted}>{[signer.email, signer.phone].filter(Boolean).join(' · ')}</p>
              <p style={FIELD_STYLES.muted}>
                {t('Validação: {verification} · Convite: {invitation}', {
                  verification: t(getMethodLabel(signer.verificationMethod)),
                  invitation: t(getMethodLabel(signer.notificationMethod)),
                })}
              </p>
            </li>
          ))}
        </ol>
        {input.sequential ? <p style={FIELD_STYLES.muted}>{t('Os signatários assinam um por vez, nesta ordem.')}</p> : null}
      </div>
      <div style={FIELD_STYLES.card}>
        <p style={FIELD_STYLES.label}>{t('Custo')}</p>
        <p style={FIELD_STYLES.strong}>
          {t(lines.total.message, lines.total.values)}
        </p>
        <p style={FIELD_STYLES.muted}>{t(lines.documents.message, lines.documents.values)}</p>
        {lines.balance ? <p style={FIELD_STYLES.muted}>{t(lines.balance.message, lines.balance.values)}</p> : null}
        {lines.blocking ? (
          <div role="alert">
            <Callout
              variant="error"
              title={t('Não é possível enviar')}
              description={t(lines.blocking.message, lines.blocking.values)}
              fullWidth
            />
          </div>
        ) : null}
      </div>
      {context.backgroundSyncAvailable ? null : (
        <p style={FIELD_STYLES.muted}>
          {t(
            'Os status deste workspace da Assinafy são atualizados quando alguém abre o documento. Para atualizações em segundo plano, peça a um administrador para compartilhar uma conexão com a Assinafy ou configurar uma chave de API.',
          )}
        </p>
      )}
      {context.recentSends.length > 0 ? (
        <div style={FIELD_STYLES.card}>
          <div role="alert">
            <Callout
              variant="warning"
              title={t('Envios recentes deste registro')}
              description={t(
                'Se um envio anterior mostrou erro ou foi interrompido, ele pode ter chegado aos signatários. Antes de enviar outro, confira esses documentos na aba Assinaturas do registro ou na lista Documentos Assinafy.',
              )}
              fullWidth
            />
          </div>
          <ul style={FIELD_STYLES.list}>
            {context.recentSends.map((recent) => (
              <li key={recent.documentRecordId} style={FIELD_STYLES.row}>
                <span style={FIELD_STYLES.text}>{recent.name ?? t('Documento sem nome')}</span>
                <StatusTag status={recent.status} />
              </li>
            ))}
          </ul>
          <CheckboxInput
            label={t('Conferi os envios recentes e quero enviar um novo documento.')}
            checked={recentSendsChecked}
            disabled={busy}
            onToggle={() => setRecentSendsChecked((checked) => !checked)}
          />
        </div>
      ) : null}
      <CheckboxInput
        label={t(lines.confirmation.message, lines.confirmation.values)}
        checked={state.confirmed}
        disabled={!prepared.estimate.sufficient || busy}
        onToggle={() => dispatch({ type: 'TOGGLE_CONFIRMED' })}
        hint={t('Os convites só são enviados depois da sua confirmação. O custo é conferido novamente logo antes do envio.')}
      />
      {state.error ? <ErrorCallout error={state.error} /> : null}
      {retryPending ? (
        <p style={FIELD_STYLES.muted}>
          {t(
            'Enviar novamente por aqui reaproveita a mesma solicitação, então o documento não é enviado duas vezes. Por isso, os dados deste envio não podem mais ser alterados. Não feche este fluxo antes de enviar novamente: um envio começado do zero não reaproveita esta solicitação.',
          )}
        </p>
      ) : null}
      <div style={FIELD_STYLES.row}>
        <Button
          variant="outline"
          disabled={busy || retryPending}
          onClick={() => dispatch({ type: 'GO_TO', step: 'SIGNERS' })}
        >
          {t('Editar signatários')}
        </Button>
        <Button variant="outline" loading={state.preparing} disabled={busy} onClick={onPrepareAgain}>
          {t('Revisar estimativa novamente')}
        </Button>
        <Button
          color="accent"
          loading={sending}
          disabled={
            busy ||
            !state.confirmed ||
            !prepared.estimate.sufficient ||
            isSendBlockedByRecentSends(context, recentSendsChecked)
          }
          onClick={onSend}
        >
          {t('Enviar para assinatura')}
        </Button>
      </div>
    </div>
  );
};
