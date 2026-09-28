import { useTranslate } from 'twenty-sdk/front-component';
import { Callout } from 'twenty-ui/components';

import { getErrorMessage } from 'src/front-components/utils/get-error-message.util';
import { type AppError } from 'src/types/app-error';

type ErrorCalloutProps = {
  error: AppError;
  action?: { label: string; onClick: () => void };
};

export const ErrorCallout = ({ error, action }: ErrorCalloutProps) => {
  const { t } = useTranslate();
  const { message, values } = getErrorMessage(error);

  return (
    <div role="alert">
      {/* The title stays on one line; the message goes in the description, which wraps. */}
      <Callout
        variant="error"
        title={t('Não foi possível continuar')}
        description={t(message, values)}
        action={action}
        fullWidth
      />
    </div>
  );
};
