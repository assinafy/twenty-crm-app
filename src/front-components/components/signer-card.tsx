import { type Dispatch, useId } from 'react';
import { msg, useTranslate } from 'twenty-sdk/front-component';
import { Button } from 'twenty-ui/primitives/input';

import { MAX_NAME_LENGTH } from 'src/constants/limits';
import { VERIFICATION_METHODS } from 'src/constants/signer-methods';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { SelectInput } from 'src/front-components/components/select-input';
import { TextInput } from 'src/front-components/components/text-input';
import { getMethodLabel } from 'src/front-components/utils/get-method-label.util';
import { type Contact } from 'src/types/contact';
import { type SendFlowAction } from 'src/types/send-flow-action';
import { type SignerDraft } from 'src/types/signer-draft';

const METHOD_NOTES = {
  Email: msg('O código de validação e o convite serão enviados para este e-mail.'),
  Whatsapp: msg('O código de validação e o convite serão enviados pelo WhatsApp. O e-mail é opcional.'),
  DigitalCertificate: msg(
    'O titular assina na Assinafy com o próprio certificado A1 ou A3. As assinaturas seguem a ordem da lista, uma por vez.',
  ),
};

type SignerCardProps = {
  signer: SignerDraft;
  index: number;
  // Template role this signer fills; groups are numbered for PDF documents.
  roleName: string | null;
  contacts: Contact[];
  removable: boolean;
  // While a prepare runs the reducer ignores edits, so the controls show they are locked.
  disabled: boolean;
  dispatch: Dispatch<SendFlowAction>;
};

export const SignerCard = ({ signer, index, roleName, contacts, removable, disabled, dispatch }: SignerCardProps) => {
  const { t } = useTranslate();
  const titleId = useId();
  const certificate = signer.verificationMethod === 'DigitalCertificate';
  const setText = (field: 'name' | 'email' | 'phone' | 'governmentId') => (value: string) =>
    dispatch({ type: 'SET_SIGNER_TEXT', index, field, value });

  return (
    <div role="group" aria-labelledby={titleId} style={FIELD_STYLES.card}>
      <p id={titleId} style={FIELD_STYLES.strong}>
        {roleName ?? t('Signatário {number}', { number: index + 1 })}
      </p>
      {contacts.length > 0 ? (
        <SelectInput
          label={t('Preencher com um contato')}
          value=""
          placeholder={t('Escolha um contato')}
          options={contacts.map((contact) => ({
            value: contact.personId,
            label: contact.name || contact.email || t('Pessoa sem nome'),
          }))}
          disabled={disabled}
          onChange={(personId) => personId && dispatch({ type: 'FILL_SIGNER', index, personId })}
        />
      ) : null}
      <TextInput
        label={t('Nome completo')}
        value={signer.name}
        maxLength={MAX_NAME_LENGTH}
        disabled={disabled}
        onChange={setText('name')}
      />
      <SelectInput
        label={t('Validação da assinatura')}
        value={signer.verificationMethod}
        disabled={disabled}
        options={VERIFICATION_METHODS.map((method) => ({ value: method, label: t(getMethodLabel(method)) }))}
        onChange={(value) =>
          dispatch({
            type: 'SET_VERIFICATION',
            index,
            method: VERIFICATION_METHODS.find((method) => method === value) ?? 'Email',
          })
        }
      />
      {certificate ? (
        <SelectInput
          label={t('Enviar convite por')}
          value={signer.notificationMethod}
          disabled={disabled}
          options={[
            { value: 'Email', label: t(getMethodLabel('Email')) },
            { value: 'Whatsapp', label: t(getMethodLabel('Whatsapp')) },
          ]}
          onChange={(value) =>
            dispatch({ type: 'SET_NOTIFICATION', index, method: value === 'Whatsapp' ? 'Whatsapp' : 'Email' })
          }
        />
      ) : null}
      <TextInput
        label={signer.notificationMethod === 'Email' ? t('E-mail') : t('E-mail (opcional)')}
        type="email"
        value={signer.email}
        disabled={disabled}
        onChange={setText('email')}
      />
      {signer.notificationMethod === 'Whatsapp' ? (
        <TextInput
          label={t('WhatsApp com DDI')}
          type="tel"
          value={signer.phone}
          placeholder="+55 11 90000-0000"
          hint={t('Informe + e o código do país, seguidos do DDD e do número.')}
          disabled={disabled}
          onChange={setText('phone')}
        />
      ) : null}
      {certificate ? (
        <TextInput
          label={t('CPF ou CNPJ do titular do certificado')}
          value={signer.governmentId}
          hint={t('Informe os 11 dígitos do CPF ou os 14 dígitos do CNPJ.')}
          disabled={disabled}
          onChange={setText('governmentId')}
        />
      ) : null}
      <p style={FIELD_STYLES.muted}>{t(METHOD_NOTES[signer.verificationMethod])}</p>
      {removable ? (
        <div style={FIELD_STYLES.row}>
          <Button
            variant="ghost"
            color="danger"
            size="sm"
            disabled={disabled}
            onClick={() => dispatch({ type: 'REMOVE_SIGNER', index })}
          >
            {t('Remover signatário')}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
