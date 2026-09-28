import { type Dispatch } from 'react';
import { useTranslate } from 'twenty-sdk/front-component';
import { Callout } from 'twenty-ui/components';
import { Button } from 'twenty-ui/primitives/input';

import { MAX_EDITOR_FIELD_VALUE_LENGTH, MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH } from 'src/constants/limits';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { SelectInput } from 'src/front-components/components/select-input';
import { TextInput } from 'src/front-components/components/text-input';
import { type SendFlowAction } from 'src/types/send-flow-action';
import { type SendFlowState } from 'src/types/send-flow-state';

type DocumentStepProps = {
  state: SendFlowState;
  dispatch: Dispatch<SendFlowAction>;
  onContinue: () => void;
};

export const DocumentStep = ({ state, dispatch, onContinue }: DocumentStepProps) => {
  const { t } = useTranslate();
  const { draft, context } = state;
  const template = context.templates.find((candidate) => candidate.id === draft.templateId);

  return (
    <div style={FIELD_STYLES.stack}>
      <SelectInput
        label={t('Origem do documento')}
        value={draft.sourceType}
        options={[
          { value: 'PDF', label: t('PDF anexado a este registro') },
          { value: 'TEMPLATE', label: t('Modelo da Assinafy') },
        ]}
        onChange={(value) =>
          dispatch({ type: 'SET_SOURCE_TYPE', sourceType: value === 'TEMPLATE' ? 'TEMPLATE' : 'PDF' })
        }
      />
      {draft.sourceType === 'PDF' ? (
        context.attachments.length > 0 ? (
          <SelectInput
            label={t('Arquivo PDF')}
            value={draft.attachmentId ?? ''}
            placeholder={t('Escolha um PDF')}
            options={context.attachments.map((attachment) => ({ value: attachment.id, label: attachment.name }))}
            onChange={(attachmentId) => dispatch({ type: 'SET_ATTACHMENT', attachmentId })}
          />
        ) : (
          <Callout
            variant="info"
            title={t('Este registro não tem PDF anexado.')}
            description={t('Anexe um PDF de até 25 MB na aba Arquivos e abra este painel novamente.')}
            fullWidth
          />
        )
      ) : context.templates.length > 0 ? (
        <SelectInput
          label={t('Modelo')}
          value={draft.templateId ?? ''}
          placeholder={t('Escolha um modelo')}
          options={context.templates.map((candidate) => ({
            value: candidate.id,
            label: candidate.unsupportedReason ? t('{name} (indisponível)', { name: candidate.name }) : candidate.name,
            disabled: candidate.unsupportedReason !== null,
          }))}
          onChange={(templateId) => dispatch({ type: 'SET_TEMPLATE', templateId })}
        />
      ) : (
        <Callout
          variant="info"
          title={t('Nenhum modelo pronto neste workspace da Assinafy.')}
          description={t('Prepare os modelos na Assinafy apenas com papéis de signatário e de editor.')}
          fullWidth
        />
      )}
      {draft.sourceType === 'TEMPLATE' && template && template.editorFields.length > 0 ? (
        <div role="group" aria-label={t('Campos do modelo')} style={FIELD_STYLES.card}>
          <p style={FIELD_STYLES.label}>{t('Campos do modelo')}</p>
          {template.editorFields.map((field) => (
            <TextInput
              key={field.fieldId}
              label={field.label}
              value={draft.editorFields[field.fieldId] ?? ''}
              maxLength={MAX_EDITOR_FIELD_VALUE_LENGTH}
              onChange={(value) => dispatch({ type: 'SET_EDITOR_FIELD', fieldId: field.fieldId, value })}
            />
          ))}
        </div>
      ) : null}
      <TextInput
        label={t('Nome do documento')}
        value={draft.name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(value) => dispatch({ type: 'SET_TEXT', field: 'name', value })}
      />
      <TextInput
        label={t('Mensagem para os signatários (opcional)')}
        value={draft.message}
        maxLength={MAX_MESSAGE_LENGTH}
        multiline
        onChange={(value) => dispatch({ type: 'SET_TEXT', field: 'message', value })}
      />
      <TextInput
        label={t('Prazo para assinar (opcional)')}
        type="date"
        value={draft.expiresOn}
        hint={t('Os signatários podem assinar até o fim deste dia.')}
        onChange={(value) => dispatch({ type: 'SET_TEXT', field: 'expiresOn', value })}
      />
      {state.error ? <ErrorCallout error={state.error} /> : null}
      <div style={FIELD_STYLES.row}>
        <Button color="accent" onClick={onContinue}>
          {t('Continuar para signatários')}
        </Button>
      </div>
    </div>
  );
};
