import { useTranslate } from 'twenty-sdk/front-component';
import { VisibilityHidden } from 'twenty-ui/primitives/accessibility';
import { Loader } from 'twenty-ui/primitives/feedback';

// A loader announced to screen readers: a live region reads its text, not an aria-label.
export const LoadingStatus = () => {
  const { t } = useTranslate();

  return (
    <div role="status">
      <Loader />
      <VisibilityHidden>{t('Carregando…')}</VisibilityHidden>
    </div>
  );
};
