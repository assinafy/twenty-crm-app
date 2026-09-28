import { msg, type MessageDescriptor } from 'twenty-sdk/front-component';
import { type ThemeColor } from 'twenty-ui/theme';

import { type DocumentStatus } from 'src/types/document-status';
import { type SignerState } from 'src/types/signer-state';
import { type StoredSigner } from 'src/types/stored-signer';
import { getSignerState } from 'src/utils/get-signer-state.util';

type SignerStatus = { label: MessageDescriptor; color: ThemeColor };

const STATUS_BY_STATE: Record<SignerState, SignerStatus> = {
  // Context: a person signed or declined, unlike the document statuses.
  SIGNED: { label: msg({ message: 'Assinou', context: 'signer' }), color: 'green' },
  DECLINED: { label: msg({ message: 'Recusou', context: 'signer' }), color: 'red' },
  DELIVERY_FAILED: { label: msg('Falha na entrega'), color: 'orange' },
  NOT_SIGNED: { label: msg('Não assinou'), color: 'gray' },
  INVITED: { label: msg('Convidado'), color: 'blue' },
  WAITING: { label: msg('Aguardando signatários anteriores'), color: 'gray' },
  NOT_INVITED: { label: msg('Convite pendente'), color: 'gray' },
};

// Same decision order as the AI status summary (getSignerState).
export const getSignerStatus = (signer: StoredSigner, document: { status: DocumentStatus | null }): SignerStatus =>
  STATUS_BY_STATE[getSignerState(signer, document.status)];
