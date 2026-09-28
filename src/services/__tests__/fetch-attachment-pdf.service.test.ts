import { MAX_UPLOAD_BYTES } from '@assinafy/sdk';
import { describe, expect, it, vi } from 'vitest';

import { ATTACHMENT_FETCH_TIMEOUT_MS } from 'src/constants/limits';
import { fetchAttachmentPdf } from 'src/services/fetch-attachment-pdf.service';

const FILE_URL = 'https://files.test.invalid/attachment.pdf';
const PDF = Buffer.from('%PDF-1.7 test');

const stubFetch = (response: Response | Error) => {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

// A body delivered in the given chunks, recording whether the reader cancelled it.
const chunkedBody = (chunks: Uint8Array[]) => {
  const state = { cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { stream, state };
};

describe('fetchAttachmentPdf', () => {
  it('downloads the PDF with a timeout and names it document.pdf', async () => {
    const fetchMock = stubFetch(new Response(PDF));
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await expect(fetchAttachmentPdf({ url: FILE_URL })).resolves.toEqual({ buffer: PDF, fileName: 'document.pdf' });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(FILE_URL, { signal: expect.any(AbortSignal) });
    expect(timeout).toHaveBeenCalledWith(ATTACHMENT_FETCH_TIMEOUT_MS);
  });

  it.each(['ftp://files.test.invalid/a.pdf', 'file:///etc/passwd', '/relative/a.pdf'])(
    'refuses the non-http FILE_URL %s without fetching',
    async (url) => {
      const fetchMock = stubFetch(new Response(PDF));

      await expect(fetchAttachmentPdf({ url })).rejects.toMatchObject({
        code: 'INVALID_INPUT',
        details: { field: 'source.attachmentId', reason: 'UNSUPPORTED_URL' },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a network error', new TypeError('fetch failed')],
    ['a timeout', new DOMException('The operation timed out.', 'TimeoutError')],
  ])('reports PROVIDER_UNAVAILABLE on %s', async (_label, error) => {
    stubFetch(error);

    await expect(fetchAttachmentPdf({ url: FILE_URL })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      details: { provider: 'twenty' },
    });
  });

  it.each([404, 500])('reports PROVIDER_UNAVAILABLE on HTTP %i', async (status) => {
    stubFetch(new Response('nope', { status }));

    await expect(fetchAttachmentPdf({ url: FILE_URL })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      details: { provider: 'twenty' },
    });
  });

  it('reports PROVIDER_UNAVAILABLE when the response has no body', async () => {
    stubFetch(new Response(null, { status: 200 }));

    await expect(fetchAttachmentPdf({ url: FILE_URL })).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      details: { provider: 'twenty' },
    });
  });

  it('rejects a declared Content-Length above the upload limit before reading', async () => {
    const { stream, state } = chunkedBody([PDF]);
    stubFetch(new Response(stream, { headers: { 'content-length': String(MAX_UPLOAD_BYTES + 1) } }));

    await expect(fetchAttachmentPdf({ url: FILE_URL })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { field: 'source.attachmentId', reason: 'FILE_TOO_LARGE' },
    });
    expect(state.cancelled).toBe(true);
  });

  it('stops reading once the streamed bytes pass the limit, whatever Content-Length claims', async () => {
    const half = new Uint8Array(MAX_UPLOAD_BYTES / 2 + 1);
    half.set(PDF);
    const { stream, state } = chunkedBody([half, half, half]);
    stubFetch(new Response(stream, { headers: { 'content-length': '10' } }));

    await expect(fetchAttachmentPdf({ url: FILE_URL })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { reason: 'FILE_TOO_LARGE' },
    });
    expect(state.cancelled).toBe(true);
  });

  it('accepts a file of exactly the upload limit', async () => {
    const exact = new Uint8Array(MAX_UPLOAD_BYTES);
    exact.set(PDF);
    stubFetch(new Response(chunkedBody([exact]).stream));

    await expect(fetchAttachmentPdf({ url: FILE_URL })).resolves.toMatchObject({ fileName: 'document.pdf' });
  });

  it.each([Buffer.from('<html>login</html>'), Buffer.alloc(0)])('rejects bytes that are not a PDF', async (bytes) => {
    stubFetch(new Response(bytes));

    await expect(fetchAttachmentPdf({ url: FILE_URL })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { field: 'source.attachmentId', reason: 'NOT_A_PDF' },
    });
  });
});
