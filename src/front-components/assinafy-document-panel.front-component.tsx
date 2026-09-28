import { useCallback, useEffect, useRef, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  msg,
  openCommandConfirmationModal,
  useSelectedRecordIds,
  useTranslate,
} from 'twenty-sdk/front-component';
import { Tag } from 'twenty-ui/primitives/data-display';
import { ProgressBar } from 'twenty-ui/primitives/feedback';
import { Button } from 'twenty-ui/primitives/input';

import { DOCUMENT_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { findAssinafyDocument } from 'src/data/find-assinafy-document';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { LoadingStatus } from 'src/front-components/components/loading-status';
import { SignedDownloads } from 'src/front-components/components/signed-downloads';
import { StatusTag } from 'src/front-components/components/status-tag';
import { callAppRoute } from 'src/front-components/utils/call-app-route.util';
import { confirmResend } from 'src/front-components/utils/confirm-resend.util';
import { createExclusiveRunner } from 'src/front-components/utils/create-exclusive-runner.util';
import { getDocumentActions } from 'src/front-components/utils/get-document-actions.util';
import { getMethodLabel } from 'src/front-components/utils/get-method-label.util';
import { getPanelError } from 'src/front-components/utils/get-panel-error.util';
import { getSignerStatus } from 'src/front-components/utils/get-signer-status.util';
import { getStatusHints } from 'src/front-components/utils/get-status-hints.util';
import { isPanelStale } from 'src/front-components/utils/is-panel-stale.util';
import { removeAssinafyDocument } from 'src/front-components/utils/remove-assinafy-document.util';
import { runResendFlow } from 'src/front-components/utils/run-resend-flow.util';
import { type AppError } from 'src/types/app-error';
import { type AppResult } from 'src/types/app-result';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type CostEstimate } from 'src/types/cost-estimate';
import { type DocumentSummary } from 'src/types/document-summary';
import { formatDate } from 'src/utils/format-date.util';
import { errorName } from 'src/utils/error-name.util';

// Widget on the Assinafy document record: status, signers, signed files and the actions the status allows.
const AssinafyDocumentPanel = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const recordId = selectedRecordIds.length === 1 ? selectedRecordIds[0] : undefined;

  // Twenty keeps the widget mounted across record navigation; a key per record starts every state over, so no action
  // targets the record shown before.
  return recordId === undefined ? null : <DocumentPanel key={recordId} recordId={recordId} />;
};

const DocumentPanel = ({ recordId }: { recordId: string }) => {
  const { t } = useTranslate();
  const [version, setVersion] = useState(0);
  // The record as last read (null once it is gone), tagged with the version it answers; null until the first read.
  const [loaded, setLoaded] = useState<{ version: number; record: AssinafyDocumentRecord | null } | null>(null);
  // The last action's error, kept apart from a failed record read so the read never replaces it.
  const [error, setError] = useState<AppError | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [runExclusive] = useState(() => createExclusiveRunner(() => setError({ code: 'INTERNAL', message: '' })));
  const autoRefreshed = useRef(false);

  const retryLoad = useCallback(() => {
    setLoadFailed(false);
    setVersion((count) => count + 1);
  }, []);

  // One action at a time; every action ends by reading the record again.
  const runAction = useCallback(
    (name: string, task: () => Promise<AppResult<DocumentSummary> | null>, success?: string) =>
      runExclusive(async () => {
        setBusyAction(name);
        setError(null);

        try {
          const result = await task();

          if (result?.ok) {
            if (success) {
              void enqueueSnackbar({ message: success, variant: 'success' });
            }
          } else if (result) {
            setError(result.error);
          }
        } finally {
          setBusyAction(null);
          setVersion((count) => count + 1);
        }
      }),
    [runExclusive],
  );

  const refresh = useCallback(() => {
    void runAction('refresh', () =>
      callAppRoute<DocumentSummary>('/s/assinafy/documents/refresh', { documentRecordId: recordId }),
    );
  }, [recordId, runAction]);

  useEffect(() => {
    let active = true;

    void findAssinafyDocument(new CoreApiClient(), recordId).then(
      (record) => {
        if (!active) {
          return;
        }

        setLoaded({ version, record });
        setLoadFailed(false);

        // Once per mount, so a refresh that cannot sync (e.g. not connected) does not loop.
        if (record && !autoRefreshed.current && isPanelStale(record, new Date())) {
          autoRefreshed.current = true;
          refresh();
        }
      },
      (loadError: unknown) => {
        console.error('[assinafy] loading the document failed', { name: errorName(loadError) });

        if (active) {
          setLoadFailed(true);
          // Unlocks the actions on the last record read, so Refresh can try again.
          setLoaded((previous) => previous && { ...previous, version });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [recordId, version, refresh]);

  const shownError = getPanelError(error, loadFailed);

  if (loaded === null) {
    return (
      <div style={FIELD_STYLES.container}>
        {shownError ? (
          <ErrorCallout error={shownError} action={{ label: t('Tentar novamente'), onClick: retryLoad }} />
        ) : (
          <LoadingStatus />
        )}
      </div>
    );
  }

  const { record } = loaded;

  if (record === null) {
    return (
      <div style={FIELD_STYLES.container}>
        <p style={FIELD_STYLES.muted}>{t('Este documento não está mais disponível.')}</p>
      </div>
    );
  }

  const documentRecordId = record.id;
  // Actions wait for the record read after the previous one, so none acts on a stale status.
  const locked = busyAction !== null || loaded.version !== version;
  const actions = getDocumentActions(record);
  const signers = record.signers ?? [];
  const signerCount = record.signerCount ?? signers.length;
  const signedCount = record.signedCount ?? 0;
  const dates = (
    [
      [record.sentAt, msg('Enviado em {date}')],
      [record.completedAt, msg('Concluído em {date}')],
      [record.expiresAt, msg('Prazo para assinar: {date}')],
      [record.lastSyncedAt, msg('Última verificação: {date}')],
    ] as const
  ).flatMap(([iso, message]) => {
    const date = formatDate(iso);

    return date ? [t(message, { date })] : [];
  });

  const resend = (signerId: string) =>
    void runAction(
      `resend:${signerId}`,
      () =>
        runResendFlow({
          documentRecordId,
          signerId,
          call: (body) =>
            callAppRoute<{ estimate: CostEstimate } | DocumentSummary>('/s/assinafy/documents/resend', body),
          confirm: (estimate) => confirmResend({ estimate, t, open: openCommandConfirmationModal }),
        }),
      t('Convite reenviado.'),
    );

  const cancel = () =>
    void runAction(
      'cancel',
      async () =>
        (await openCommandConfirmationModal({
          title: t('Cancelar esta solicitação de assinatura?'),
          subtitle: t('Os links de assinatura deixam de funcionar e ninguém mais poderá assinar. Não é possível desfazer.'),
          confirmButtonText: t('Sim, cancelar a solicitação'),
          confirmButtonAccent: 'danger',
        })) === 'confirm'
          ? callAppRoute<DocumentSummary>('/s/assinafy/documents/cancel', { documentRecordId })
          : null,
      t('Solicitação de assinatura cancelada.'),
    );

  // Native soft delete: the record has nothing to cancel in Assinafy.
  const remove = () =>
    void runAction('remove', async () => {
      const confirmed =
        (await openCommandConfirmationModal({
          title: t('Remover este documento do Twenty?'),
          subtitle: t('Ele fica nos registros excluídos de Documentos Assinafy, de onde pode ser restaurado.'),
          confirmButtonText: t('Remover'),
          confirmButtonAccent: 'danger',
        })) === 'confirm';

      if (!confirmed) {
        return null;
      }

      const failure = await removeAssinafyDocument(new CoreApiClient(), documentRecordId);

      if (failure) {
        return { ok: false, error: failure };
      }

      void enqueueSnackbar({ message: t('Documento removido do Twenty.'), variant: 'success' });

      return null;
    });

  return (
    <div style={FIELD_STYLES.container}>
      <div style={FIELD_STYLES.row}>
        <StatusTag status={record.status} />
        <span style={FIELD_STYLES.muted}>
          {t('Assinaturas: {signed} de {total}', { signed: signedCount, total: signerCount })}
        </span>
      </div>
      {signerCount > 0 ? (
        <ProgressBar
          value={Math.min(100, Math.round((signedCount / signerCount) * 100))}
          ariaLabel={t('Andamento das assinaturas')}
          barColor="var(--t-color-blue)"
          backgroundColor="var(--t-background-tertiary)"
          withBorderRadius
        />
      ) : null}
      {getStatusHints(record).map((hint) => (
        <p key={hint.message.message} style={FIELD_STYLES.text}>
          {t(hint.message, hint.values)}
        </p>
      ))}
      {dates.map((date) => (
        <p key={date} style={FIELD_STYLES.muted}>
          {date}
        </p>
      ))}
      <SignedDownloads files={record.signedDocument} />
      {signers.length > 0 ? (
        <ul style={FIELD_STYLES.list}>
          {signers.map((signer) => {
            const status = getSignerStatus(signer, { status: record.status });

            return (
              <li key={signer.id} style={FIELD_STYLES.card}>
                <div style={FIELD_STYLES.row}>
                  <span style={FIELD_STYLES.text}>{signer.name}</span>
                  <Tag color={status.color}>{t(status.label)}</Tag>
                </div>
                <p style={FIELD_STYLES.muted}>
                  {[
                    signer.notificationMethod === 'Whatsapp' ? signer.phone : signer.email,
                    signer.verificationMethod ? t(getMethodLabel(signer.verificationMethod)) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {actions.resendSignerIds.includes(signer.id) ? (
                  <div style={FIELD_STYLES.row}>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busyAction === `resend:${signer.id}`}
                      disabled={locked}
                      aria-label={t('Reenviar convite para {name}', { name: signer.name })}
                      onClick={() => resend(signer.id)}
                    >
                      {t('Reenviar convite')}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {shownError ? <ErrorCallout error={shownError} /> : null}
      <div style={FIELD_STYLES.row}>
        <Button variant="outline" loading={busyAction === 'refresh'} disabled={locked} onClick={refresh}>
          {t('Atualizar')}
        </Button>
        {actions.cancel ? (
          <Button variant="outline" color="danger" loading={busyAction === 'cancel'} disabled={locked} onClick={cancel}>
            {t('Cancelar solicitação')}
          </Button>
        ) : null}
        {actions.remove ? (
          <Button variant="outline" color="danger" loading={busyAction === 'remove'} disabled={locked} onClick={remove}>
            {t('Remover do Twenty')}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: DOCUMENT_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'assinafy-document-panel',
  description: 'Mostra o status da assinatura do Documento Assinafy e permite atualizar, reenviar ou cancelar a solicitação.',
  component: AssinafyDocumentPanel,
});
