import { ApiError, NetworkError } from '@assinafy/sdk';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/data/update-assinafy-document', () => ({ updateAssinafyDocument: vi.fn<typeof updateAssinafyDocument>() }));
vi.mock('src/data/upload-signed-file', () => ({ uploadSignedFile: vi.fn<typeof uploadSignedFile>() }));

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { SEND_LEASE_MS } from 'src/constants/limits';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { uploadSignedFile } from 'src/data/upload-signed-file';
import {
  assignment,
  documentDetails,
  documentRecord,
  fakeAssinafyClient,
  resolvedCredential,
} from 'src/services/__tests__/service-fixtures';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type AssinafyDocumentPatch } from 'src/types/assinafy-document-patch';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

const update = vi.mocked(updateAssinafyDocument);
const upload = vi.mocked(uploadSignedFile);
const LEASE_START = new Date(NOW.getTime() - SEND_LEASE_MS).toISOString();
const IN_LEASE = new Date(NOW.getTime() - SEND_LEASE_MS + 1).toISOString();
const ARTIFACTS = { original: 'https://api.test.invalid/original' };

const pending = (overrides: Partial<AssinafyDocumentRecord> = {}) =>
  documentRecord({
    status: 'PENDING_SIGNATURE',
    assinafyAssignmentId: 'assignment-1',
    sentAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  });

const setup = () => {
  const fake = fakeAssinafyClient();
  const ctx = buildContext();
  update.mockImplementation(async (_core, id, patch) => documentRecord({ id, ...patch }));
  fake.documents.details.mockResolvedValue(documentDetails({ status: 'pending_signature', assignment: assignment() }));
  fake.documents.download.mockImplementation(async (_id, artifact) => Buffer.from(`%PDF-${artifact}`));
  upload.mockImplementation(async (_metadata, { filename }) => ({ fileId: `file-${filename}`, label: filename }));
  const sync = (record: AssinafyDocumentRecord) => syncAssinafyDocument(ctx, record, resolvedCredential(fake.client));
  return { fake, ctx, sync };
};

const lastPatch = (): AssinafyDocumentPatch | undefined => update.mock.lastCall?.[2];

describe('syncAssinafyDocument — records without an Assinafy answer', () => {
  it('leaves a SENDING record alone while its send may still run', async () => {
    const { fake, sync } = setup();
    const record = documentRecord({ status: 'SENDING', updatedAt: IN_LEASE });

    await expect(sync(record)).resolves.toBe(record);
    expect(fake.documents.details).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('marks an abandoned SENDING record without a document UNCERTAIN', async () => {
    const { fake, ctx, sync } = setup();

    await sync(documentRecord({ status: 'SENDING', assinafyDocumentId: null, updatedAt: LEASE_START }));

    expect(update).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-doc-1', {
      status: 'UNCERTAIN',
      lastError: 'UNCERTAIN',
      lastSyncedAt: NOW.toISOString(),
    });
    expect(fake.documents.details).not.toHaveBeenCalled();
  });

  it('marks an abandoned SENDING record without a document UNCERTAIN without a credential', async () => {
    const { fake, ctx } = setup();

    await expect(
      syncAssinafyDocument(
        ctx,
        documentRecord({ status: 'SENDING', assinafyDocumentId: null, updatedAt: LEASE_START }),
        null,
      ),
    ).resolves.toMatchObject({ status: 'UNCERTAIN' });
    expect(fake.documents.details).not.toHaveBeenCalled();
  });

  it('refuses to read a document from Assinafy without a credential', async () => {
    const { fake, ctx } = setup();

    await expect(syncAssinafyDocument(ctx, pending(), null)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(fake.documents.details).not.toHaveBeenCalled();
  });

  it('leaves an UNCERTAIN template record without a document unchanged', async () => {
    const { fake, sync } = setup();
    const record = documentRecord({ status: 'UNCERTAIN', assinafyDocumentId: null, updatedAt: LEASE_START });

    await expect(sync(record)).resolves.toBe(record);
    expect(fake.documents.details).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('syncAssinafyDocument — refresh', () => {
  it('writes the patch built from the document details with the application client', async () => {
    const { fake, ctx, sync } = setup();

    const result = await sync(pending());

    expect(fake.documents.details).toHaveBeenCalledExactlyOnceWith('doc-1');
    expect(update).toHaveBeenCalledExactlyOnceWith(
      ctx.appCore,
      'record-doc-1',
      expect.objectContaining({
        status: 'PENDING_SIGNATURE',
        assinafyAssignmentId: 'assignment-1',
        signerCount: 1,
        signedCount: 0,
        lastSyncedAt: NOW.toISOString(),
        lastError: null,
      }),
    );
    expect(lastPatch()).not.toHaveProperty('sentAt');
    expect(result.status).toBe('PENDING_SIGNATURE');
  });

  it('marks a document Assinafy no longer has CANCELLED', async () => {
    const { fake, ctx, sync } = setup();
    fake.documents.details.mockRejectedValue(new ApiError('Not found', 404));

    await expect(sync(pending())).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(update).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-doc-1', {
      status: 'CANCELLED',
      completedAt: NOW.toISOString(),
      lastError: 'NOT_FOUND',
      lastSyncedAt: NOW.toISOString(),
    });
  });

  it('keeps a final status when Assinafy no longer has the document', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockRejectedValue(new ApiError('Not found', 404));

    await sync(pending({ status: 'CERTIFICATED', completedAt: '2026-09-21T10:00:00.000Z' }));

    expect(lastPatch()).toEqual({ lastSyncedAt: NOW.toISOString() });
  });

  it('keeps why a send failed when its purged upload is no longer in Assinafy', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockRejectedValue(new ApiError('Not found', 404));

    await sync(documentRecord({ status: 'FAILED', lastError: 'PROVIDER_REJECTED' }));

    expect(lastPatch()).toEqual({ lastSyncedAt: NOW.toISOString() });
  });

  it.each([
    [() => new NetworkError('timeout'), 'PROVIDER_UNAVAILABLE'],
    [() => new ApiError('Unauthorized', 401), 'RECONNECT_REQUIRED'],
    [() => new ApiError('Too many requests', 429), 'RATE_LIMITED'],
  ])('reports a failed refresh of a final record without storing its code (%#)', async (error, code) => {
    const { fake, ctx, sync } = setup();
    fake.documents.details.mockRejectedValue(error());

    await expect(sync(pending({ status: 'CERTIFICATED' }))).rejects.toMatchObject({ code });
    expect(update).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-doc-1', { lastSyncedAt: NOW.toISOString() });
  });

  it.each([
    ['CERTIFICATED', null, null],
    ['FAILED', 'PROVIDER_REJECTED', 'PROVIDER_REJECTED'],
  ] as const)('leaves no refresh error on a %s record after a failed then a successful sync', async (status, stored, expected) => {
    const { fake, sync } = setup();
    let record = documentRecord({ status, lastError: stored });
    update.mockImplementation(async (_core, _id, patch) => {
      record = { ...record, ...patch };
      return record;
    });
    fake.documents.details.mockRejectedValueOnce(new NetworkError('timeout'));

    await expect(sync(record)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    await sync(record);

    expect(record.lastError).toBe(expected);
  });

  it.each([
    [() => new NetworkError('timeout'), 'PROVIDER_UNAVAILABLE'],
    [() => new ApiError('Server error', 500), 'PROVIDER_UNAVAILABLE'],
    [() => new ApiError('Unauthorized', 401), 'RECONNECT_REQUIRED'],
    [() => new ApiError('Forbidden', 403), 'FORBIDDEN'],
  ])('records any other failure on the record and rethrows it (%#)', async (error, code) => {
    const { fake, ctx, sync } = setup();
    fake.documents.details.mockRejectedValue(error());

    await expect(sync(pending())).rejects.toMatchObject({ code });
    expect(update).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-doc-1', {
      lastSyncedAt: NOW.toISOString(),
      lastError: code,
    });
  });

  it('rethrows the failure even when recording it fails', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockRejectedValue(new NetworkError('timeout'));
    update.mockRejectedValue(new Error('Twenty unavailable'));

    await expect(sync(pending())).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(console.warn).toHaveBeenCalledWith('[assinafy] recording a sync failure failed', {
      code: 'PROVIDER_UNAVAILABLE',
      name: 'Error',
    });
  });

  it('records a failed Twenty write as INTERNAL', async () => {
    const { sync } = setup();
    update.mockRejectedValueOnce(new Error('GraphQL error'));

    await expect(sync(pending())).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(lastPatch()).toEqual({ lastSyncedAt: NOW.toISOString(), lastError: 'INTERNAL' });
  });
});

const certificated = (artifacts: Record<string, string> = ARTIFACTS) =>
  documentDetails({ status: 'certificated', assignment: assignment(), artifacts: { ...ARTIFACTS, ...artifacts } });

describe('syncAssinafyDocument — signed files', () => {
  it('always stores the certificated PDF of a certificated document, even when not listed', async () => {
    const { fake, ctx, sync } = setup();
    fake.documents.details.mockResolvedValue(certificated());

    await expect(sync(pending({ status: 'CERTIFICATING' }))).resolves.toMatchObject({ status: 'CERTIFICATED' });

    expect(fake.documents.download).toHaveBeenCalledExactlyOnceWith('doc-1', 'certificated');
    expect(upload).toHaveBeenCalledExactlyOnceWith(ctx.appMetadata, {
      buffer: Buffer.from('%PDF-certificated'),
      filename: 'Service agreement - assinado.pdf',
    });
    expect(lastPatch()).toMatchObject({
      status: 'CERTIFICATED',
      signedCount: 1,
      signedDocument: [{ fileId: 'file-Service agreement - assinado.pdf', label: 'Service agreement - assinado.pdf' }],
      lastError: null,
    });
  });

  it('also stores the ICP-Brasil PDF when Assinafy lists it', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(certificated({ pades: 'https://api.test.invalid/pades' }));

    await sync(pending());

    expect(fake.documents.download.mock.calls).toEqual([
      ['doc-1', 'certificated'],
      ['doc-1', 'pades'],
    ]);
    expect(lastPatch()?.signedDocument?.map((file) => file.label)).toEqual([
      'Service agreement - assinado.pdf',
      'Service agreement - ICP-Brasil.pdf',
    ]);
  });

  it('downloads only the files not stored yet', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(certificated({ pades: 'https://api.test.invalid/pades' }));
    const stored = { fileId: 'file-1', label: 'Service agreement - assinado.pdf', url: 'https://files.test.invalid/1' };

    await sync(pending({ status: 'CERTIFICATING', signedDocument: [stored] }));

    expect(fake.documents.download).toHaveBeenCalledExactlyOnceWith('doc-1', 'pades');
    expect(lastPatch()?.signedDocument).toEqual([
      { fileId: 'file-1', label: 'Service agreement - assinado.pdf' },
      { fileId: 'file-Service agreement - ICP-Brasil.pdf', label: 'Service agreement - ICP-Brasil.pdf' },
    ]);
  });

  it('writes no files when every expected one is already stored', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(certificated());

    await sync(pending({ status: 'CERTIFICATING', signedDocument: [{ fileId: 'f', label: 'Service agreement - assinado.pdf' }] }));

    expect(fake.documents.download).not.toHaveBeenCalled();
    expect(lastPatch()).toMatchObject({ status: 'CERTIFICATED' });
    expect(lastPatch()).not.toHaveProperty('signedDocument');
  });

  it('replaces files stored under a previous name', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(certificated());

    await sync(pending({ status: 'CERTIFICATING', signedDocument: [{ fileId: 'old', label: 'Old name - assinado.pdf' }] }));

    expect(lastPatch()?.signedDocument).toEqual([
      { fileId: 'file-Service agreement - assinado.pdf', label: 'Service agreement - assinado.pdf' },
    ]);
  });

  it('stays CERTIFICATING with SIGNED_FILES_PENDING and keeps what it stored when a file fails', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(certificated({ pades: 'https://api.test.invalid/pades' }));
    fake.documents.download.mockImplementation(async (_id, artifact) => {
      if (artifact === 'pades') throw new ApiError('Artefato não está disponível.', 404);
      return Buffer.from('%PDF-');
    });

    await expect(sync(pending())).resolves.toMatchObject({ status: 'CERTIFICATING' });
    expect(lastPatch()).toMatchObject({
      status: 'CERTIFICATING',
      lastError: 'SIGNED_FILES_PENDING',
      signedDocument: [{ fileId: 'file-Service agreement - assinado.pdf', label: 'Service agreement - assinado.pdf' }],
    });
    expect(console.warn).toHaveBeenCalledWith('[assinafy] storing a signed file failed', {
      artifact: 'pades',
      code: 'NOT_FOUND',
    });
  });

  it('keeps CERTIFICATING when the Twenty upload fails', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(certificated());
    upload.mockRejectedValue(new Error('upload failed'));

    await sync(pending());

    expect(lastPatch()).toMatchObject({ status: 'CERTIFICATING', lastError: 'SIGNED_FILES_PENDING' });
    expect(lastPatch()).not.toHaveProperty('signedDocument');
  });

  it('never downloads again for a record already signed', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(certificated());

    await sync(pending({ status: 'CERTIFICATED', signedDocument: [{ fileId: 'f', label: 'Renamed - assinado.pdf' }] }));

    expect(fake.documents.download).not.toHaveBeenCalled();
    expect(lastPatch()).toMatchObject({ status: 'CERTIFICATED' });
  });
});

describe('syncAssinafyDocument — unconfirmed sends', () => {
  const uncertain = (overrides: Partial<AssinafyDocumentRecord> = {}) =>
    documentRecord({ status: 'UNCERTAIN', lastError: 'UNCERTAIN', updatedAt: LEASE_START, ...overrides });

  it('resolves an UNCERTAIN record whose document has an assignment to PENDING_SIGNATURE', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ status: 'uploaded', assignment: assignment() }));

    await sync(uncertain());

    expect(lastPatch()).toMatchObject({
      status: 'PENDING_SIGNATURE',
      assinafyAssignmentId: 'assignment-1',
      sentAt: NOW.toISOString(),
      lastError: null,
    });
  });

  it('resolves a document past draft to its status and keeps a known sentAt', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ status: 'pending_signature', assignment: null }));

    await sync(uncertain({ sentAt: '2026-09-24T10:00:00.000Z' }));

    expect(lastPatch()).toMatchObject({ status: 'PENDING_SIGNATURE', sentAt: '2026-09-24T10:00:00.000Z' });
  });

  it.each([
    ['UNCERTAIN', uncertain()],
    ['abandoned SENDING', documentRecord({ status: 'SENDING', updatedAt: LEASE_START })],
  ])('marks an %s draft without an assignment FAILED (NOT_SENT)', async (_label, record) => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ status: 'metadata_ready', assignment: null }));

    await sync(record);

    expect(lastPatch()).toMatchObject({ status: 'FAILED', lastError: 'NOT_SENT' });
    expect(lastPatch()).not.toHaveProperty('sentAt');
  });

  it('waits before concluding NOT_SENT while a timed-out request could still land', async () => {
    const { fake, sync } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ status: 'metadata_ready', assignment: null }));

    await sync(uncertain({ updatedAt: IN_LEASE }));

    expect(lastPatch()).toMatchObject({ status: 'UNCERTAIN', lastError: 'UNCERTAIN', lastSyncedAt: NOW.toISOString() });
  });
});
