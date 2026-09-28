import { useEffect, useReducer, useRef, useState } from 'react';
import { enqueueSnackbar, msg, useTranslate } from 'twenty-sdk/front-component';
import { Callout } from 'twenty-ui/components';
import { Button } from 'twenty-ui/primitives/input';

import { DocumentStep } from 'src/front-components/components/document-step';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { LoadingStatus } from 'src/front-components/components/loading-status';
import { ReviewStep } from 'src/front-components/components/review-step';
import { SignersStep } from 'src/front-components/components/signers-step';
import { buildSendRequest } from 'src/front-components/utils/build-send-request.util';
import { callAppRoute } from 'src/front-components/utils/call-app-route.util';
import { createExclusiveRunner } from 'src/front-components/utils/create-exclusive-runner.util';
import { createRequestId } from 'src/front-components/utils/create-request-id.util';
import { createSendFlowState } from 'src/front-components/utils/create-send-flow-state.util';
import { findDraftError } from 'src/front-components/utils/find-draft-error.util';
import { getPrepareRequest } from 'src/front-components/utils/get-prepare-request.util';
import { getSendRecordId } from 'src/front-components/utils/get-send-record-id.util';
import { openAssinafyDocument } from 'src/front-components/utils/open-assinafy-document.util';
import { prepareAfterDiscard } from 'src/front-components/utils/prepare-after-discard.util';
import { sendFlowReducer } from 'src/front-components/utils/send-flow-reducer.util';
import { type AppResult } from 'src/types/app-result';
import { type DiscardInput } from 'src/types/discard-input';
import { type DocumentSummary } from 'src/types/document-summary';
import { type PreparedSignatureRequest } from 'src/types/prepared-signature-request';
import { type SignatureContext } from 'src/types/signature-context';
import { type SignatureRequestProposal } from 'src/types/signature-request-proposal';

const STEPS = [
  { step: 'DOCUMENT', label: msg('Documento') },
  { step: 'SIGNERS', label: msg('Signatários') },
  { step: 'REVIEW', label: msg('Revisar e enviar') },
] as const;

const discardUpload = ({ assinafyDocumentId, accountId }: DiscardInput) =>
  callAppRoute('/s/assinafy/discard', { assinafyDocumentId, accountId });

type SendFlowProps = {
  recordId: string;
  proposal?: SignatureRequestProposal | null;
  onSent?: (summary: DocumentSummary) => void;
  // Called once the send route answered, whatever the outcome, even after the member left the flow.
  onSendSettled?: () => void;
};

const SendFlowSteps = ({
  context,
  proposal,
  onSent,
  onSendSettled,
}: Omit<SendFlowProps, 'recordId'> & { context: SignatureContext }) => {
  const { t } = useTranslate();
  const [state, dispatch] = useReducer(sendFlowReducer, null, () => createSendFlowState(context, proposal));
  const latest = useRef(state);
  // Blocks a second click before the re-render: a stale state would mint a second request id.
  const [runExclusive] = useState(() =>
    createExclusiveRunner(() => dispatch({ type: 'SHOW_ERROR', error: { code: 'INTERNAL', message: '' } })),
  );
  const announced = useRef<string | null>(null);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  // Best effort: an upload no send was attempted with is deleted when the flow closes; the background purge covers
  // what this misses.
  useEffect(
    () => () => {
      const { upload } = latest.current;

      if (upload && !upload.sendAttempted) {
        void discardUpload(upload);
      }
    },
    [],
  );

  useEffect(() => {
    const { result } = state;

    if (state.step !== 'DONE' || result === null || announced.current === result.documentRecordId) {
      return;
    }

    announced.current = result.documentRecordId;
    void enqueueSnackbar({ message: t('Documento enviado para assinatura.'), variant: 'success' });
    onSent?.(result);
    void openAssinafyDocument(result.documentRecordId);
  }, [state, t, onSent]);

  const exclusive = (task: () => Promise<void>) => () => runExclusive(task);

  const continueToSigners = () => {
    const error = findDraftError(state, 'DOCUMENT', new Date());

    dispatch(error ? { type: 'SHOW_ERROR', error } : { type: 'GO_TO', step: 'SIGNERS' });
  };

  const prepare = exclusive(async () => {
    const error = findDraftError(state, 'DOCUMENT', new Date()) ?? findDraftError(state, 'SIGNERS', new Date());

    if (error) {
      dispatch({ type: 'SHOW_ERROR', error });

      return;
    }

    const { body, discard } = getPrepareRequest(state);

    // First: locks the draft and clears the stale upload, so neither an edit nor the unmount cleanup races the discard.
    dispatch({ type: 'PREPARE_STARTED' });

    const result = await prepareAfterDiscard(discard && (() => discardUpload(discard)), () =>
      callAppRoute<PreparedSignatureRequest>('/s/assinafy/prepare', body),
    );

    dispatch(
      result.ok ? { type: 'PREPARE_SUCCEEDED', prepared: result } : { type: 'PREPARE_FAILED', error: result.error },
    );
  });

  const send = exclusive(async () => {
    const body = buildSendRequest(state, createRequestId);

    if (body === null) {
      return;
    }

    dispatch({ type: 'SEND_STARTED', requestId: body.requestId });

    const result = await callAppRoute<DocumentSummary>('/s/assinafy/send', body);

    onSendSettled?.();
    dispatch(result.ok ? { type: 'SEND_SUCCEEDED', summary: result } : { type: 'SEND_FAILED', error: result.error });
  });

  if (state.step === 'DONE' || state.step === 'ERROR') {
    const documentRecordId = getSendRecordId(state);

    return (
      <div style={FIELD_STYLES.stack}>
        {state.step === 'DONE' ? (
          <Callout
            variant="success"
            title={t('Documento enviado para assinatura.')}
            description={t('A Assinafy recebeu a solicitação. Acompanhe as assinaturas no documento.')}
            fullWidth
          />
        ) : state.error ? (
          <ErrorCallout error={state.error} />
        ) : null}
        {documentRecordId ? (
          <div style={FIELD_STYLES.row}>
            <Button variant="outline" onClick={() => void openAssinafyDocument(documentRecordId)}>
              {t('Abrir documento')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const current = state.step === 'SENDING' ? 'REVIEW' : state.step;

  return (
    <div style={FIELD_STYLES.stack}>
      <ol aria-label={t('Etapas do envio')} style={{ ...FIELD_STYLES.row, listStyle: 'none', margin: 0, padding: 0 }}>
        {STEPS.map(({ step, label }, index) => (
          <li
            key={step}
            aria-current={step === current ? 'step' : undefined}
            style={step === current ? FIELD_STYLES.strong : FIELD_STYLES.muted}
          >
            {`${index + 1}. ${t(label)}`}
          </li>
        ))}
      </ol>
      {current === 'DOCUMENT' ? (
        <DocumentStep state={state} dispatch={dispatch} onContinue={continueToSigners} />
      ) : null}
      {current === 'SIGNERS' ? <SignersStep state={state} dispatch={dispatch} onPrepare={prepare} /> : null}
      {current === 'REVIEW' ? (
        <ReviewStep state={state} dispatch={dispatch} onSend={send} onPrepareAgain={prepare} />
      ) : null}
    </div>
  );
};

// Loads the record's signature context, then runs Document → Signers → Review → send.
export const SendFlow = ({ recordId, proposal = null, onSent, onSendSettled }: SendFlowProps) => {
  const { t } = useTranslate();
  const [attempt, setAttempt] = useState(0);
  // Each result remembers the request it answers, so a retry or another record shows the loader until its answer.
  const [loaded, setLoaded] = useState<{
    recordId: string;
    attempt: number;
    context: AppResult<SignatureContext>;
  } | null>(null);

  useEffect(() => {
    let active = true;

    void callAppRoute<SignatureContext>('/s/assinafy/context', { recordId }).then((context) => {
      if (active) {
        setLoaded({ recordId, attempt, context });
      }
    });

    return () => {
      active = false;
    };
  }, [recordId, attempt]);

  if (loaded === null || loaded.recordId !== recordId || loaded.attempt !== attempt) {
    return <LoadingStatus />;
  }

  const { context } = loaded;
  const retry = { label: t('Tentar novamente'), onClick: () => setAttempt((count) => count + 1) };

  if (!context.ok) {
    return <ErrorCallout error={context.error} action={retry} />;
  }

  if (context.sendingAs === null) {
    return <ErrorCallout error={{ code: 'NOT_CONNECTED', message: '' }} action={retry} />;
  }

  return (
    <SendFlowSteps
      key={context.record.id}
      context={context}
      proposal={proposal}
      onSent={onSent}
      onSendSettled={onSendSettled}
    />
  );
};
