import { ApiError, NetworkError } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, kv } = await vi.hoisted(async () => (await import('src/services/__tests__/kv-store')).createKvStore());

vi.mock('twenty-sdk/logic-function', () => ({ kv }));
vi.mock('src/data/find-upload-reference', () => ({ findUploadReference: vi.fn<typeof findUploadReference>() }));

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { PENDING_UPLOAD_MAX_AGE_MS, PENDING_UPLOAD_TTL_MS } from 'src/constants/limits';
import { findUploadReference } from 'src/data/find-upload-reference';
import {
  assignment,
  documentDetails,
  documentRecord,
  fakeAssinafyClient,
  resolvedCredential,
} from 'src/services/__tests__/service-fixtures';
import { purgePendingUploads } from 'src/services/purge-pending-uploads.service';

const referenced = vi.mocked(findUploadReference);
const { appCore } = buildContext();
const OLD = new Date(NOW.getTime() - PENDING_UPLOAD_TTL_MS).toISOString();
const RECENT = new Date(NOW.getTime() - PENDING_UPLOAD_TTL_MS + 1).toISOString();
const EXPIRED = new Date(NOW.getTime() - PENDING_UPLOAD_MAX_AGE_MS).toISOString();
const entry = (documentId: string, createdAt = OLD, accountId = 'account-1') => ({
  documentId,
  accountId,
  userWorkspaceId: 'member-1',
  createdAt,
});

type Fake = ReturnType<typeof fakeAssinafyClient>;

const setup = () => {
  const fake = fakeAssinafyClient();
  fake.documents.details.mockResolvedValue(documentDetails());
  fake.documents.delete.mockResolvedValue(undefined);
  referenced.mockResolvedValue(null);
  return { fake, credentials: [resolvedCredential(fake.client)] };
};

describe('purgePendingUploads', () => {
  beforeEach(() => store.clear());

  it('deletes uploads older than the TTL and forgets them', async () => {
    const { fake, credentials } = setup();
    store.set(KV_PENDING_UPLOADS, [entry('doc-old'), entry('doc-recent', RECENT)]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(1);

    expect(fake.documents.details).toHaveBeenCalledExactlyOnceWith('doc-old');
    expect(fake.documents.delete).toHaveBeenCalledExactlyOnceWith('doc-old');
    expect(referenced).toHaveBeenCalledExactlyOnceWith(appCore, 'doc-old');
    expect(store.get(KV_PENDING_UPLOADS)).toEqual([entry('doc-recent', RECENT)]);
  });

  it.each([
    ['assigned', documentDetails({ status: 'pending_signature', assignment: assignment() })],
    ['past draft', documentDetails({ status: 'expired' })],
    ['in another workspace', documentDetails({ account_id: 'account-2' })],
  ])('never deletes an upload that is %s, and forgets it', async (_label, details) => {
    const { fake, credentials } = setup();
    fake.documents.details.mockResolvedValue(details);
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(fake.documents.delete).not.toHaveBeenCalled();
    expect(referenced).not.toHaveBeenCalled();
    expect(store.get(KV_PENDING_UPLOADS)).toEqual([]);
  });

  it('keeps an unsent upload a send record points at, without deleting it', async () => {
    const { fake, credentials } = setup();
    referenced.mockResolvedValue(documentRecord());
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(fake.documents.delete).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  it('checks the send records after Assinafy, right before the delete', async () => {
    const { fake, credentials } = setup();
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await purgePendingUploads(credentials, NOW, appCore);

    const checkedAt = referenced.mock.invocationCallOrder[0] ?? Infinity;
    expect(checkedAt).toBeGreaterThan(fake.documents.details.mock.invocationCallOrder[0] ?? Infinity);
    expect(checkedAt).toBeLessThan(fake.documents.delete.mock.invocationCallOrder[0] ?? -Infinity);
  });

  it('keeps uploads of a workspace no credential reaches', async () => {
    const { fake, credentials } = setup();
    store.set(KV_PENDING_UPLOADS, [entry('doc-1', OLD, 'account-2')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(fake.documents.delete).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  it('forgets, without deleting, an upload no credential reaches once it reaches the max age', async () => {
    const { fake, credentials } = setup();
    store.set(KV_PENDING_UPLOADS, [entry('doc-1', EXPIRED, 'account-2'), entry('doc-2', OLD, 'account-2')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(fake.documents.details).not.toHaveBeenCalled();
    expect(fake.documents.delete).not.toHaveBeenCalled();
    expect(store.get(KV_PENDING_UPLOADS)).toEqual([entry('doc-2', OLD, 'account-2')]);
  });

  it('keeps uploads recorded while it runs and does not bring back ones forgotten meanwhile', async () => {
    const { fake, credentials } = setup();
    store.set(KV_PENDING_UPLOADS, [entry('doc-old'), entry('doc-gone', RECENT)]);
    fake.documents.delete.mockImplementation(async () => {
      store.set(KV_PENDING_UPLOADS, [entry('doc-old'), entry('doc-new', RECENT)]);
    });

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(1);

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([entry('doc-new', RECENT)]);
  });

  it('forgets an upload Assinafy answers 404 to deleting', async () => {
    const { fake, credentials } = setup();
    fake.documents.delete.mockRejectedValue(new ApiError('Not found', 404));
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([]);
  });

  it('keeps an upload Assinafy answers 400 to deleting while it is younger than the max age', async () => {
    const { fake, credentials } = setup();
    const young = new Date(NOW.getTime() - PENDING_UPLOAD_MAX_AGE_MS + 1).toISOString();
    fake.documents.delete.mockRejectedValue(new ApiError('Cannot delete', 400));
    store.set(KV_PENDING_UPLOADS, [entry('doc-1', young)]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(kv.set).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('forgets an upload Assinafy answers 400 to deleting once it reaches the max age', async () => {
    const { fake, credentials } = setup();
    fake.documents.delete.mockRejectedValue(new ApiError('Cannot delete', 400));
    store.set(KV_PENDING_UPLOADS, [entry('doc-1', EXPIRED)]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([]);
  });

  it('forgets an upload Assinafy no longer has, without deleting it', async () => {
    const { fake, credentials } = setup();
    fake.documents.details.mockRejectedValue(new ApiError('Not found', 404));
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(fake.documents.delete).not.toHaveBeenCalled();
    expect(store.get(KV_PENDING_UPLOADS)).toEqual([]);
  });

  it('keeps the upload when Assinafy cannot tell its state', async () => {
    const { fake, credentials } = setup();
    fake.documents.details.mockRejectedValue(new NetworkError('timeout'));
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(fake.documents.delete).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  it.each([
    ['an Assinafy outage', () => new NetworkError('timeout'), 'PROVIDER_UNAVAILABLE'],
    ['a server error', () => new ApiError('Server error', 500), 'PROVIDER_UNAVAILABLE'],
  ])('keeps the upload for the next run on %s', async (_label, error, code) => {
    const { fake, credentials } = setup();
    fake.documents.delete.mockRejectedValueOnce(error());
    store.set(KV_PENDING_UPLOADS, [entry('doc-1'), entry('doc-2')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(1);

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([entry('doc-1')]);
    expect(console.warn).toHaveBeenCalledWith('[assinafy] purging a pending upload failed', { code });
  });

  it('keeps the upload when the Twenty check fails', async () => {
    const { fake, credentials } = setup();
    referenced.mockRejectedValue(new Error('GraphQL error'));
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(fake.documents.delete).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  it.each([
    ['details refuses access', (fake: Fake) => fake.documents.details.mockRejectedValue(new ApiError('Forbidden', 403))],
    ['the delete is refused', (fake: Fake) => fake.documents.delete.mockRejectedValue(new ApiError('Unprocessable', 422))],
    ['the delete times out', (fake: Fake) => fake.documents.delete.mockRejectedValue(new NetworkError('timeout'))],
    ['a send still references it', () => referenced.mockResolvedValue(documentRecord())],
    ['the Twenty check fails', () => referenced.mockRejectedValue(new Error('GraphQL error'))],
  ])('forgets, without deleting, an upload at the max age when %s', async (_label, arrange) => {
    const { fake, credentials } = setup();
    arrange(fake);
    const young = new Date(NOW.getTime() - PENDING_UPLOAD_MAX_AGE_MS + 1).toISOString();
    store.set(KV_PENDING_UPLOADS, [entry('doc-1', EXPIRED), entry('doc-2', young)]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([entry('doc-2', young)]);
  });

  it.each([
    ['without an assignment', documentDetails({ status: 'failed', assignment: null }), 1],
    ['with an assignment', documentDetails({ status: 'FAILED', assignment: assignment() }), 0],
  ])('handles an upload whose Assinafy processing failed %s', async (_label, details, deleted) => {
    const { fake, credentials } = setup();
    fake.documents.details.mockResolvedValue(details);
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(deleted);

    expect(fake.documents.delete).toHaveBeenCalledTimes(deleted);
    expect(store.get(KV_PENDING_UPLOADS)).toEqual([]);
  });

  it.each([
    [new Error('kv down'), 'Error'],
    ['kv down', 'string'],
  ])('never throws (%o)', async (error, name) => {
    const { credentials } = setup();
    kv.get.mockRejectedValueOnce(error);

    await expect(purgePendingUploads(credentials, NOW, appCore)).resolves.toBe(0);
    expect(console.warn).toHaveBeenCalledWith('[assinafy] purgePendingUploads failed', { name });
  });
});
