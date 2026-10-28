import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { openCommandConfirmationModal, useTranslate } from 'twenty-sdk/front-component';
import { Button } from 'twenty-ui/primitives/input';

import { CheckboxInput } from 'src/front-components/components/checkbox-input';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { LoadingStatus } from 'src/front-components/components/loading-status';
import { SelectInput } from 'src/front-components/components/select-input';
import { TextInput } from 'src/front-components/components/text-input';
import { buildContractTerms } from 'src/front-components/utils/build-contract-terms.util';
import { callAppRoute } from 'src/front-components/utils/call-app-route.util';
import { contractPanelReducer } from 'src/front-components/utils/contract-panel-reducer.util';
import { getContractActions } from 'src/front-components/utils/get-contract-actions.util';
import { toContractDraft } from 'src/front-components/utils/to-contract-draft.util';
import { type AppError } from 'src/types/app-error';
import { type ContractDraft } from 'src/types/contract-draft';
import { type ContractInput } from 'src/types/contract-input';
import { type ContractPanelState } from 'src/types/contract-panel-state';
import { type ContractSummary } from 'src/types/contract-summary';
import { type ContractTerms } from 'src/types/contract-terms';
import { formatDate } from 'src/utils/format-date.util';

type RootContract = Extract<ContractSummary, { kind: 'contract' }>;
type ContractPanelProps = {
  documentRecordId: string;
  disabled: boolean;
  runTask: (task: () => Promise<void>) => Promise<void>;
};

const ContractEditor = ({
  contract, editable, disabled, save,
}: {
  contract: RootContract | null;
  editable: boolean;
  disabled: boolean;
  save: (terms: ContractTerms) => void;
}) => {
  const { t } = useTranslate();
  const [draft, setDraft] = useState(() => toContractDraft(contract));
  const [error, setError] = useState<AppError | null>(null);
  const locked = disabled || !editable;
  const text = (field: Exclude<keyof ContractDraft, 'auto_renew' | 'status'>) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  };
  const submit = () => {
    const result = buildContractTerms(draft);
    if (result.ok) save(result.terms);
    else setError(result.error);
  };

  return (
    <div style={FIELD_STYLES.stack}>
      <SelectInput
        label={t('Status do contrato')}
        value={editable ? draft.status : (contract?.status ?? draft.status)}
        disabled={locked}
        options={[
          { value: 'draft', label: t('Rascunho'), disabled: contract?.status === 'active' },
          { value: 'active', label: t('Vigente') },
          { value: 'expired', label: t('Vencido'), disabled: true },
          { value: 'terminated', label: t('Encerrado'), disabled: true },
        ]}
        onChange={(status) => setDraft((current) => ({ ...current, status: status === 'active' ? 'active' : 'draft' }))}
      />
      <TextInput label={t('Contraparte')} value={draft.counterparty_name} maxLength={255} disabled={locked} onChange={text('counterparty_name')} />
      <TextInput label={t('Valor do contrato')} value={draft.value} hint={t('Use até duas casas decimais, sem separador de milhar. Deixe em branco se não houver valor.')} disabled={locked} onChange={text('value')} />
      <TextInput label={t('Moeda')} value={draft.currency} maxLength={3} hint={t('Código de três letras, por exemplo BRL.')} disabled={locked} onChange={text('currency')} />
      <TextInput label={t('Início da vigência')} type="date" value={draft.start_date} disabled={locked} onChange={text('start_date')} />
      <TextInput label={t('Fim da vigência')} type="date" value={draft.end_date} disabled={locked} onChange={text('end_date')} />
      <CheckboxInput label={t('Renovar automaticamente')} checked={draft.auto_renew} disabled={locked} onToggle={() => setDraft((current) => ({ ...current, auto_renew: !current.auto_renew }))} />
      <TextInput label={t('Período de renovação (meses)')} value={draft.renewal_term_months} hint={t('De 1 a 600; em branco usa o período definido pela Assinafy.')} disabled={locked} onChange={text('renewal_term_months')} />
      <TextInput label={t('Antecedência do aviso (dias)')} value={draft.notice_period_days} hint={t('De 0 a 3650; em branco desativa o aviso.')} disabled={locked} onChange={text('notice_period_days')} />
      {error ? <ErrorCallout error={error} /> : null}
      {editable ? (
        <div style={FIELD_STYLES.row}>
          <Button color="accent" disabled={disabled} onClick={submit}>{t('Salvar condições do contrato')}</Button>
        </div>
      ) : null}
    </div>
  );
};

const ContractContent = ({ documentRecordId, disabled, runTask }: ContractPanelProps) => {
  const { t } = useTranslate();
  const [state, dispatch] = useReducer(contractPanelReducer, {
    contract: null, loaded: false, busy: false, refreshRequired: false, revision: 0, error: null,
  } satisfies ContractPanelState);
  const [reason, setReason] = useState('');
  const initialReadStarted = useRef(false);
  const perform = useCallback(async (body: ContractInput) => {
    dispatch({ type: 'START' });
    const result = await callAppRoute<{ contract: ContractSummary | null }>('/s/assinafy/documents/contract', body)
      .catch(() => ({ ok: false as const, error: { code: 'INTERNAL' as const, message: '' } }));
    dispatch({ type: 'SETTLE', mutation: body.action !== 'get', result });
  }, []);
  const refresh = useCallback(() => runTask(async () => {
    initialReadStarted.current = true;
    await perform({ documentRecordId, action: 'get' });
  }), [documentRecordId, perform, runTask]);

  useEffect(() => {
    if (!disabled && !initialReadStarted.current) void refresh();
  }, [disabled, refresh]);

  const { contract } = state;
  const actions = getContractActions(contract);
  const locked = disabled || state.busy || state.refreshRequired;
  const renew = () => void runTask(async () => {
    if (contract?.kind !== 'contract' || !actions.renew || locked) return;
    if (await openCommandConfirmationModal({
      title: t('Renovar este contrato?'),
      subtitle: t('A Assinafy iniciará a próxima vigência conforme o período de renovação. O PDF assinado não será alterado.'),
      confirmButtonText: t('Renovar contrato'),
      confirmButtonAccent: 'blue',
    }) === 'confirm') {
      await perform({ documentRecordId, action: 'renew', updatedAt: contract.updatedAt, term: contract.term });
    }
  });
  const terminate = () => void runTask(async () => {
    if (contract?.kind !== 'contract' || !actions.terminate || locked) return;
    if (await openCommandConfirmationModal({
      title: t('Encerrar este contrato?'),
      subtitle: t('O acompanhamento e os avisos de vigência serão encerrados. Esta ação não cancela assinaturas nem altera o PDF assinado.'),
      confirmButtonText: t('Encerrar contrato'),
      confirmButtonAccent: 'danger',
    }) === 'confirm') {
      await perform({ documentRecordId, action: 'terminate', updatedAt: contract.updatedAt, reason: reason.trim() || null });
    }
  });

  return (
    <div style={FIELD_STYLES.card}>
      <p style={FIELD_STYLES.strong}>{t('Gestão do contrato')}</p>
      <p style={FIELD_STYLES.muted}>{t('As condições ficam na Assinafy. Alterá-las aqui não modifica o PDF nem solicita novas assinaturas. Os avisos de vigência são gerenciados pela Assinafy.')}</p>
      {state.busy ? <LoadingStatus /> : null}
      {state.error ? <ErrorCallout error={state.error} /> : null}
      {state.refreshRequired ? <p role="alert" style={FIELD_STYLES.text}>{t('Atualize o contrato para conferir o resultado antes de fazer outra alteração.')}</p> : null}
      {state.loaded ? (
        contract?.kind === 'amendment' ? (
          <div style={FIELD_STYLES.stack}>
            <p style={FIELD_STYLES.text}>
              {contract.relationType === 'renewal' ? t('Instrumento de renovação') : contract.relationType === 'termination' ? t('Instrumento de encerramento') : t('Aditivo contratual')}
            </p>
            <p style={FIELD_STYLES.text}>{contract.status === 'applied' ? t('Aplicado ao contrato principal') : t('Aguardando aplicação ao contrato principal')}</p>
            {contract.appliedAt ? <p style={FIELD_STYLES.muted}>{t('Aplicado em {date}', { date: formatDate(contract.appliedAt) ?? '' })}</p> : null}
            <p style={FIELD_STYLES.muted}>{t('Gerencie o contrato principal e seus instrumentos na Assinafy.')}</p>
          </div>
        ) : (
          <>
            {contract ? <p style={FIELD_STYLES.text}>{t('Vigência: {term}', { term: contract.term })}</p> : <p style={FIELD_STYLES.text}>{t('Este documento ainda não tem condições de contrato cadastradas.')}</p>}
            <ContractEditor key={state.revision} contract={contract} editable={actions.edit} disabled={locked} save={(terms) => {
              if (!locked && actions.edit) void runTask(() => perform({ documentRecordId, action: 'set', updatedAt: contract?.updatedAt ?? null, terms }));
            }} />
            {actions.terminate ? <TextInput label={t('Motivo do encerramento (opcional)')} value={reason} maxLength={500} disabled={locked} onChange={setReason} /> : null}
            <div style={FIELD_STYLES.row}>
              {actions.renew ? <Button variant="outline" disabled={locked} onClick={renew}>{t('Renovar contrato')}</Button> : null}
              {actions.terminate ? <Button variant="outline" color="danger" disabled={locked} onClick={terminate}>{t('Encerrar contrato')}</Button> : null}
            </div>
          </>
        )
      ) : null}
      <div style={FIELD_STYLES.row}>
        <Button variant="outline" disabled={disabled || state.busy} onClick={() => void refresh()}>{t('Atualizar contrato')}</Button>
      </div>
    </div>
  );
};

export const ContractPanel = ({ documentRecordId, disabled, runTask }: ContractPanelProps) => {
  const { t } = useTranslate();
  const [opened, setOpened] = useState(false);

  return opened ? <ContractContent documentRecordId={documentRecordId} disabled={disabled} runTask={runTask} /> : (
    <div style={FIELD_STYLES.row}>
      <Button variant="outline" disabled={disabled} onClick={() => setOpened(true)}>{t('Gestão do contrato')}</Button>
    </div>
  );
};
