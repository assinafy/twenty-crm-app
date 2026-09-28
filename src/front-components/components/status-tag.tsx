import { useTranslate } from 'twenty-sdk/front-component';
import { Tag } from 'twenty-ui/primitives/data-display';

import { getStatusDisplay } from 'src/front-components/utils/get-status-display.util';
import { type DocumentStatus } from 'src/types/document-status';

export const StatusTag = ({ status }: { status: DocumentStatus | null }) => {
  const { t } = useTranslate();
  const { label, color } = getStatusDisplay(status);

  return <Tag color={color}>{t(label)}</Tag>;
};
