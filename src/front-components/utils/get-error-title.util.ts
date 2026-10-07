import { msg, type MessageDescriptor } from 'twenty-sdk/front-component';

import { type AppErrorCode } from 'src/types/app-error-code';

// An uncertain send may have gone out (and been charged): a failure title would invite a second, paid send.
export const getErrorTitle = (code: AppErrorCode): { variant: 'error' | 'warning'; title: MessageDescriptor } =>
  code === 'UNCERTAIN'
    ? { variant: 'warning', title: msg('Confira na Assinafy antes de enviar de novo') }
    : { variant: 'error', title: msg('Não foi possível continuar') };
