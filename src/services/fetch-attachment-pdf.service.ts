import { MAX_UPLOAD_BYTES } from '@assinafy/sdk';

import { ATTACHMENT_FETCH_TIMEOUT_MS } from 'src/constants/limits';
import { AppFailure } from 'src/utils/app-failure.util';
import { invalidInput } from 'src/utils/invalid-input.util';

const PDF_SIGNATURE = '%PDF-';

// The failing system is Twenty, not Assinafy: the detail lets the front end say so.
const unavailable = (): AppFailure =>
  new AppFailure('PROVIDER_UNAVAILABLE', 'Não foi possível baixar o anexo do Twenty. Tente novamente em instantes.', {
    provider: 'twenty',
  });

const isHttpUrl = (url: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

// Reads at most MAX_UPLOAD_BYTES whatever Content-Length claims, so a large file never fills the function's memory.
const readCapped = async (body: ReadableStream<Uint8Array>): Promise<Buffer> => {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > MAX_UPLOAD_BYTES) {
      await reader.cancel();
      throw invalidInput('source.attachmentId', 'FILE_TOO_LARGE');
    }
    chunks.push(chunk.value);
  }

  return Buffer.concat(chunks);
};

// The display name travels separately (upload option `name`), so the file part always has a safe PDF name.
export const fetchAttachmentPdf = async ({ url }: { url: string }): Promise<{ buffer: Buffer; fileName: string }> => {
  if (!isHttpUrl(url)) {
    throw invalidInput('source.attachmentId', 'UNSUPPORTED_URL');
  }

  let buffer: Buffer;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(ATTACHMENT_FETCH_TIMEOUT_MS) });
    if (!response.ok || response.body === null) {
      throw unavailable();
    }
    if (Number(response.headers.get('content-length')) > MAX_UPLOAD_BYTES) {
      await response.body.cancel();
      throw invalidInput('source.attachmentId', 'FILE_TOO_LARGE');
    }
    buffer = await readCapped(response.body);
  } catch (error) {
    throw error instanceof AppFailure ? error : unavailable();
  }

  if (buffer.subarray(0, PDF_SIGNATURE.length).toString('latin1') !== PDF_SIGNATURE) {
    throw invalidInput('source.attachmentId', 'NOT_A_PDF');
  }

  return { buffer, fileName: 'document.pdf' };
};
