import { useCallback, useEffect, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds, useTranslate } from 'twenty-sdk/front-component';
import { Button } from 'twenty-ui/primitives/input';

import { RECORD_SIGNATURES_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { findRecordDocuments } from 'src/data/find-record-documents';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { LoadingStatus } from 'src/front-components/components/loading-status';
import { SendFlow } from 'src/front-components/components/send-flow';
import { SignedDownloads } from 'src/front-components/components/signed-downloads';
import { StatusTag } from 'src/front-components/components/status-tag';
import { openAssinafyDocument } from 'src/front-components/utils/open-assinafy-document.util';
import { toLoadError } from 'src/front-components/utils/to-load-error.util';
import { type AppError } from 'src/types/app-error';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { formatDate } from 'src/utils/format-date.util';
import { errorName } from 'src/utils/error-name.util';

// "Signatures" tab of Person, Company and Opportunity records: their Assinafy documents, and the send flow.
const RecordSignatures = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const recordId = selectedRecordIds.length === 1 ? selectedRecordIds[0] : undefined;

  // Twenty keeps the tab mounted across record navigation; a key per record starts every state over, so the list and
  // an open send flow never belong to the record shown before.
  return recordId === undefined ? null : <SignaturesTab key={recordId} recordId={recordId} />;
};

const SignaturesTab = ({ recordId }: { recordId: string }) => {
  const { t } = useTranslate();
  const [sending, setSending] = useState(false);
  const [version, setVersion] = useState(0);
  // Each result remembers the version it answers; the previous list stays visible while a reload runs.
  const [loaded, setLoaded] = useState<{ version: number; documents: AssinafyDocumentRecord[] | AppError } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    const settle = (documents: AssinafyDocumentRecord[] | AppError) => active && setLoaded({ version, documents });

    void findRecordDocuments(new CoreApiClient(), recordId).then(settle, (error: unknown) => {
      console.error('[assinafy] listing record documents failed', { name: errorName(error) });
      settle(toLoadError(error));
    });

    return () => {
      active = false;
    };
  }, [recordId, version]);

  const reload = useCallback(() => setVersion((count) => count + 1), []);

  // Every way out of the flow re-reads the list, so a send that failed or has no known outcome shows its record.
  const closeSendFlow = useCallback(() => {
    setSending(false);
    reload();
  }, [reload]);

  if (sending) {
    return (
      <div style={FIELD_STYLES.container}>
        <div style={FIELD_STYLES.row}>
          <Button variant="ghost" size="sm" onClick={closeSendFlow}>
            {t('Voltar aos documentos')}
          </Button>
        </div>
        {/* A send still running when the member goes back reloads the list again once it answers. */}
        <SendFlow recordId={recordId} onSent={closeSendFlow} onSendSettled={reload} />
      </div>
    );
  }

  return (
    <div style={FIELD_STYLES.container}>
      <div style={FIELD_STYLES.row}>
        <Button color="accent" onClick={() => setSending(true)}>
          {t('Enviar para assinatura')}
        </Button>
        <Button variant="ghost" loading={loaded !== null && loaded.version !== version} onClick={reload}>
          {t('Atualizar')}
        </Button>
      </div>
      {loaded === null ? (
        <LoadingStatus />
      ) : !Array.isArray(loaded.documents) ? (
        <ErrorCallout error={loaded.documents} action={{ label: t('Tentar novamente'), onClick: reload }} />
      ) : loaded.documents.length === 0 ? (
        <p style={FIELD_STYLES.muted}>
          {t(
            'Nenhum documento foi enviado para assinatura a partir deste registro. Envie um PDF anexado a ele ou um modelo da Assinafy.',
          )}
        </p>
      ) : (
        <ul style={FIELD_STYLES.list}>
          {loaded.documents.map((document) => {
            const sentAt = formatDate(document.sentAt);

            return (
              <li key={document.id} style={FIELD_STYLES.card}>
                <div style={FIELD_STYLES.row}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void openAssinafyDocument(document.id)}
                  >
                    {document.name ?? t('Documento sem nome')}
                  </Button>
                  <StatusTag status={document.status} />
                </div>
                <p style={FIELD_STYLES.muted}>
                  {t('Assinaturas: {signed} de {total}', {
                    signed: document.signedCount ?? 0,
                    total: document.signerCount ?? 0,
                  })}
                  {sentAt ? ` · ${t('Enviado em {date}', { date: sentAt })}` : ''}
                </p>
                <SignedDownloads files={document.signedDocument} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: RECORD_SIGNATURES_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'record-signatures',
  description: 'Lista os Documentos Assinafy do registro e envia novos documentos para assinatura.',
  component: RecordSignatures,
});
