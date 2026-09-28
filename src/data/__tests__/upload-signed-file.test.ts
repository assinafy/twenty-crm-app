import { describe, expect, it, vi } from 'vitest';
import { type MetadataApiClient } from 'twenty-client-sdk/metadata';

import { SIGNED_DOCUMENT_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { uploadSignedFile } from 'src/data/upload-signed-file';

describe('uploadSignedFile', () => {
  it('uploads to the signedDocument field and returns the file item', async () => {
    const uploadFile = vi.fn<MetadataApiClient['uploadFile']>().mockResolvedValue({
      id: 'file-1',
      path: 'files/file-1',
      size: 4,
      createdAt: '2026-01-02T00:00:00.000Z',
      url: 'https://files.test.invalid/file-1',
    });
    const buffer = Buffer.from('%PDF');

    const item = await uploadSignedFile({ uploadFile } as unknown as MetadataApiClient, {
      buffer,
      filename: 'Contract - assinado.pdf',
    });

    expect(uploadFile).toHaveBeenCalledWith({
      fileBuffer: buffer,
      filename: 'Contract - assinado.pdf',
      fieldMetadataUniversalIdentifier: SIGNED_DOCUMENT_FIELD_UNIVERSAL_IDENTIFIER,
    });
    expect(item).toEqual({ fileId: 'file-1', label: 'Contract - assinado.pdf' });
  });
});
