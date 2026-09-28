import { msg, type MessageDescriptor } from 'twenty-sdk/front-component';
import { type ThemeColor } from 'twenty-ui/theme';

import { DOCUMENT_STATUS_OPTIONS } from 'src/constants/document-status-options';
import { type DocumentStatus } from 'src/types/document-status';

type StatusDisplay = { label: MessageDescriptor; color: ThemeColor };

// One option per status, so every status has an entry.
const STATUS_DISPLAY = Object.fromEntries(
  DOCUMENT_STATUS_OPTIONS.map(({ value, label, color }) => [value, { label: msg(label), color }]),
) as Record<DocumentStatus, StatusDisplay>;

export const getStatusDisplay = (status: DocumentStatus | null): StatusDisplay => STATUS_DISPLAY[status ?? 'UNKNOWN'];
