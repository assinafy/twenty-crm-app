import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds, useTranslate } from 'twenty-sdk/front-component';

import { SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { SendFlow } from 'src/front-components/components/send-flow';

// Opened by the Person, Company and Opportunity commands; the server resolves the object from the record id.
const SendForSignature = () => {
  const { t } = useTranslate();
  const selectedRecordIds = useSelectedRecordIds();
  const recordId = selectedRecordIds.length === 1 ? selectedRecordIds[0] : undefined;

  return (
    <div style={FIELD_STYLES.container}>
      {recordId ? (
        <SendFlow recordId={recordId} />
      ) : (
        <p style={FIELD_STYLES.muted}>{t('Selecione um único registro para enviar um documento para assinatura.')}</p>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'send-for-signature',
  description: 'Envia um PDF anexado ao registro, ou um modelo da Assinafy, para assinatura eletrônica.',
  component: SendForSignature,
});
