import { useTranslate } from 'twenty-sdk/front-component';
import { Callout } from 'twenty-ui/components';

import { AppButton } from 'src/front-components/components/app-button';
import { getErrorMessage } from 'src/front-components/utils/get-error-message.util';
import { getErrorTitle } from 'src/front-components/utils/get-error-title.util';
import { type AppError } from 'src/types/app-error';

type ErrorCalloutProps = {
  error: AppError;
  action?: { label: string; onClick: () => void };
};

export const ErrorCallout = ({ error, action }: ErrorCalloutProps) => {
  const { t } = useTranslate();
  const { message, values } = getErrorMessage(error);
  const { variant, title } = getErrorTitle(error.code);

  return (
    <div role="alert">
      <Callout
        status={variant}
        title={t(title)}
        description={t(message, values)}
        action={action ? <AppButton variant="outline" onClick={action.onClick}>{action.label}</AppButton> : undefined}
        fullWidth
      />
    </div>
  );
};
