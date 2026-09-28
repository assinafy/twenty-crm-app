// Bound on ids Assinafy generates (documents, templates, fields, roles, signers, accounts).
export const MAX_ASSINAFY_ID_LENGTH = 64;
export const MAX_SIGNERS = 20;
export const MAX_NAME_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_EDITOR_FIELDS = 50;
export const MAX_EDITOR_FIELD_VALUE_LENGTH = 500;
export const MAX_ADDITIONAL_CONTACTS = 10;
// The review step warns about sends to the same record created within this window (at most MAX_RECENT_SENDS listed).
export const RECENT_SEND_WINDOW_MS = 60 * 60 * 1000;
export const MAX_RECENT_SENDS = 5;

// Assinafy rejects deadlines less than one hour ahead; the send re-checks with a margin for review time and clock skew.
export const MIN_EXPIRATION_MINUTES = 60;
export const SEND_MIN_EXPIRATION_MINUTES = 65;

export const PROVIDER_MESSAGE_MAX_LENGTH = 300;
export const AUTH_FAILURE_REASON_MAX_LENGTH = 1000;

export const SEND_TIMEOUT_SECONDS = 120;
// A SENDING record older than this belongs to a send that can no longer be running.
export const SEND_LEASE_MS = (SEND_TIMEOUT_SECONDS + 60) * 1000;
// Time a billable call needs to settle once started: the Assinafy client timeout (30 s, never retried) plus about 5 s
// to record the outcome. A send with a deadline never starts a billable call with less time left.
export const BILLABLE_CALL_BUDGET_MS = 35_000;

export const SYNC_TIMEOUT_SECONDS = 240;
export const SYNC_BUDGET_RATIO = 0.8;
export const SYNC_BATCH_SIZE = 50;
export const SYNC_WINDOW_DAYS = 120;
export const PANEL_STALE_AFTER_MS = 5 * 60 * 1000;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const PENDING_UPLOAD_TTL_MS = DAY_MS;
// A send or a re-estimate refuses an upload this old. The hour before PENDING_UPLOAD_TTL_MS is far longer than a send
// run and covers clock skew, so a send can never still be claiming or assigning an upload the purge looks at.
export const PENDING_UPLOAD_SEND_CUTOFF_MS = PENDING_UPLOAD_TTL_MS - 60 * 60 * 1000;
// Past this age the purge forgets an entry it could not delete (no credential, still referenced, or failing).
export const PENDING_UPLOAD_MAX_AGE_MS = 7 * DAY_MS;
export const MAX_PENDING_UPLOADS = 200;

export const ATTACHMENT_FETCH_TIMEOUT_MS = 30_000;
