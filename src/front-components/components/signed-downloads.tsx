import { useTranslate } from 'twenty-sdk/front-component';

import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// Links to the signed PDFs stored on the record; they open in a new tab so the widget keeps its state.
export const SignedDownloads = ({ files }: { files: AssinafyDocumentRecord['signedDocument'] }) => {
  const { t } = useTranslate();
  const available = (files ?? []).filter((file) => file.url);

  if (available.length === 0) {
    return null;
  }

  return (
    <div style={FIELD_STYLES.row}>
      {available.map((file) => (
        <a
          key={file.fileId}
          href={file.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...FIELD_STYLES.text, color: 'var(--t-color-blue)' }}
          title={file.label}
        >
          {t('Baixar {file}', { file: file.label })}
        </a>
      ))}
    </div>
  );
};
