import { type DOCUMENT_STATUS } from 'src/constants/document-status';

export type DocumentStatus = (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];
