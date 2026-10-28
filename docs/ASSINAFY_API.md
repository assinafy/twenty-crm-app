# Assinafy API integration reference

This reference covers every Assinafy SDK method called by the shipped Twenty app, plus the OAuth token endpoint handled by Twenty. The full SDK resource reference for operations outside this app is available in [the official TypeScript SDK documentation](https://github.com/assinafy/typescript-sdk/tree/main/docs). Use the [live Assinafy API reference](https://api.assinafy.com.br/v1/docs) and [OpenAPI document](https://api.assinafy.com.br/v1/docs/openapi.json) as the contract authority.

## Transport and authentication

The application calls `https://api.assinafy.com.br/v1` over HTTPS. OAuth consent uses `https://auth.assinafy.com.br/oauth/authorize`. Only the live suite uses `https://sandbox.assinafy.com.br/v1`; the end-to-end harness rewrites a temporary app copy to its simulator.

`AssinafyClient` receives either `apiKey` (sent as `X-Api-Key`) or `token` (sent as `Authorization: Bearer`). Never supply both. The resolved workspace ID is set as the client's `accountId`. The default timeout is 30 seconds and safe reads can retry twice. The installed `@assinafy/sdk` 2.9.1 does not replay billable assignment, template creation or resend calls. The app wraps those calls with `billable` to preserve uncertain outcomes.

Successful JSON HTTP responses use `{ "status": 200, "message": "", "data": ... }`. Single-resource SDK methods return `data` directly; list methods return `{ data, meta }`. `meta` comes from `X-Pagination-Current-Page`, `X-Pagination-Total-Count`, `X-Pagination-Page-Count` and `X-Pagination-Per-Page`. Downloads return bytes. OAuth responses have their own payloads.

## Signing payloads

All identifiers and contact data below are synthetic. Replace them with values resolved for the selected workspace. Expiration must be at least 65 minutes ahead when this app sends. A1 and A3 use the same `DigitalCertificate` API value; the certificate stays with its owner.

Signer creation:

```json
{"full_name":"Ana Exemplo","email":"ana@example.invalid","whatsapp_phone_number":"+5511900000000"}
```

The WhatsApp phone is omitted for email invitations. A certificate or biometric signer additionally receives this update before assignment:

```json
{"government_id":"11144477735"}
```

The government ID is sent only to Assinafy and is never persisted in Twenty. Email verification sends `verification_method: "Email"` with `notification_methods: ["Email"]`; WhatsApp verification sends `"Whatsapp"` with `["Whatsapp"]`; certificate verification (`"DigitalCertificate"`, A1 or A3 certificate media chosen by the signer at signing time) takes either channel, chosen by the member. A certificate signer requires `method: "virtual"`: the certificate flow completes the signer's virtual item, while the ordinary signing endpoint refuses certificate signers and cannot submit placed `collect` fields. SDK 2.9.1 rejects this combination before `assignments.estimateCost` or `assignments.create` makes a request, with `ValidationError.errors.code` set to `digital_certificate_requires_virtual_method`. The API derives a template assignment's method from its placed fields and rejects certificate signers for a `collect` template. SDK 2.9.1 still rejects `DigitalCertificate` before both template estimate and creation calls, including templates without placed fields; the app therefore supports certificate signers only for PDFs. A CNPJ has 14 characters and may contain letters; the app sends it upper-cased without punctuation. Biometric verification (`IdDocumentFaceMatchBasic`) also accepts either notification channel, requires a checksum-valid CPF (CNPJ is rejected), and runs entirely in Assinafy with the signer’s consent. The app stores only the verification status, never photos, evidence or the government ID. An `InReview` result is approved or declined in Assinafy; `pending_identity_review` remains open and polled until that decision allows certification. Exactly one notification channel is sent per signer. The app assigns contiguous steps starting at 1 whenever a certificate signer is present, or when the member selects sequential signing.

Biometric PDF send (the same signer options apply to template roles):

```json
{"method":"virtual","signers":[{"id":"signer-example","verification_method":"IdDocumentFaceMatchBasic","notification_methods":["Whatsapp"]}]}
```

PDF estimate:

```json
{"method":"virtual","signers":[{"verification_method":"Email","notification_methods":["Email"]}]}
```

PDF send:

```json
{"method":"virtual","signers":[{"id":"signer-example","verification_method":"DigitalCertificate","notification_methods":["Email"],"step":1}],"message":"Revise e assine o documento.","expires_at":"2027-01-01T23:59:59Z"}
```

Template estimate:

```json
{"signers":[{"role_id":"role-example","verification_method":"Whatsapp","notification_methods":["Whatsapp"]}]}
```

Template send:

```json
{"signers":[{"role_id":"role-example","id":"signer-example","verification_method":"Email","notification_methods":["Email"]}],"name":"Contrato","message":"Revise e assine o documento.","expires_at":"2027-01-01T23:59:59Z","editor_fields":[{"field_id":"field-example","value":"Valor preenchido"}]}
```

Optional null values are omitted from provider payloads. Template role and field IDs come from the template; Assinafy IDs are strings and are not Twenty UUIDs.

Cost response example:

```json
{"status":200,"message":"","data":{"documents":1,"credits":0.45,"needs_extra_document":false,"extra_document_cost":0,"total_credits":0.45,"breakdown":[{"code":"WhatsappNotification","name":"WhatsApp","cost":0.45,"quantity":1,"unit_cost":0.45}],"document_balance":10,"credit_balance":5,"has_sufficient_resources":true,"blocking_reason":null,"message":null}}
```

The price always comes from Assinafy, rather than a hardcoded tariff. `normalizeCostEstimate` requires nonnegative finite costs and nonnegative safe integer document counts. Missing or malformed billable amounts fail closed. Confirmation compares `total_credits` in cents and `documents` exactly. The legacy resend payload is also accepted:

```json
{"total":0.45,"breakdown":[{"code":"WhatsappNotification","name":"WhatsApp","cost":0.45}],"credit_balance":5,"has_sufficient_credits":true}
```

## Contract management in Twenty

The document panel calls the authenticated member route `POST /s/assinafy/documents/contract` for a document with a confirmed send. The member must be able to read its Twenty record; mutations also require update permission. The account and document IDs come from that record, and one credential is used throughout the operation. Contract reads need `documents:read`; writes need `documents:write` and a plan that includes contract tracking. These scopes are already part of the app's OAuth grant.

Every request includes the Twenty record UUID. The four complete request shapes are:

```json
{"documentRecordId":"0fda299f-860a-4dad-893a-84cb5bc74a51","action":"get"}
```

```json
{"documentRecordId":"0fda299f-860a-4dad-893a-84cb5bc74a51","action":"set","updatedAt":null,"terms":{"status":"active","counterparty_name":"Empresa Exemplo","value":120000.5,"currency":"BRL","start_date":"2026-11-01","end_date":"2027-10-31","auto_renew":true,"renewal_term_months":12,"notice_period_days":30}}
```

```json
{"documentRecordId":"0fda299f-860a-4dad-893a-84cb5bc74a51","action":"renew","updatedAt":"2026-10-28T12:00:00Z","term":1}
```

```json
{"documentRecordId":"0fda299f-860a-4dad-893a-84cb5bc74a51","action":"terminate","updatedAt":"2026-10-28T12:00:00Z","reason":"Contrato substituído por um novo acordo."}
```

For an existing contract, `set` sends the `updatedAt` returned by the preceding read; `null` is valid only while no contract exists. The app re-reads before every mutation and passes the same timestamp as `updated_at` to Assinafy. Renewal also sends the current `term`, advances by `renewal_term_months` (12 when unset), and preserves the value. New and editable root terms use `draft` or `active`; closed contracts cannot be edited, expired contracts can be renewed, and terminated contracts cannot be reopened. The termination reason stays in Assinafy's document activity. These operations change contract tracking and do not send signing notifications or cancel signatures.

Successful member responses use HTTP 200 and the app envelope. A root contract returns all of the following fields:

```json
{"ok":true,"contract":{"kind":"contract","status":"active","counterparty_name":"Empresa Exemplo","value":120000.5,"currency":"BRL","start_date":"2026-11-01","end_date":"2027-10-31","auto_renew":true,"renewal_term_months":12,"notice_period_days":30,"term":1,"updatedAt":"2026-10-28T12:00:00Z"}}
```

An amendment is read-only in Twenty and exposes only its own relationship, status and timestamps:

```json
{"ok":true,"contract":{"kind":"amendment","status":"pending","relationType":"amendment","appliedAt":null,"updatedAt":"2026-10-28T12:00:00Z"}}
```

No tracked terms returns `{"ok":true,"contract":null}`. Nullable root fields are `counterparty_name`, `value`, `currency`, `start_date`, `end_date`, `renewal_term_months` and `notice_period_days`. Root statuses are `draft`, `active`, `expired` and `terminated`; amendment statuses are `pending` and `applied`, with relationship types `amendment`, `renewal` and `termination`.

The sanitized result is mirrored in the application-writable `contractDetails` field. `contractStatus` stores `DRAFT`, `ACTIVE`, `EXPIRED`, `TERMINATED`, `AMENDMENT_PENDING` or `AMENDMENT_APPLIED`, and `contractSyncedAt` records the last sync attempt. Taxpayer IDs, owners, metadata, external references, other documents' names, amendment deltas and raw provider payloads are excluded. Contract fields are independent of signature status, signer data and signed files. A successful provider mutation remains successful if its local mirror write fails.

The periodic sync reads existing tracked contracts in `contractSyncedAt` order, including certificated documents and contracts older than the signature sync window. It alternates the contract and signature queues within the run's time budget. A failed read preserves the last known terms and advances the attempt timestamp; unavailable credentials also advance it so other contracts can sync. Initial terms are discovered by opening the panel or by a contract webhook. Webhooks accelerate these reads and are optional.

## OAuth requests and responses

The authorization redirect requests `response_type=code`, the exact registered redirect URI `<SERVER_URL>/auth/apps/callback`, all seven app scopes, a fresh `state`, and PKCE `code_challenge_method=S256`. Twenty owns this flow; server variables configure a confidential client. `offline_access` provides a rotating refresh token. Each grant covers one workspace.

Authorization-code exchange (form-encoded, symbolic secret values):

```text
grant_type=authorization_code&code=AUTH_CODE&redirect_uri=REGISTERED_REDIRECT_URI&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&code_verifier=PKCE_VERIFIER
```

Refresh:

```text
grant_type=refresh_token&refresh_token=CURRENT_REFRESH_TOKEN&client_id=CLIENT_ID&client_secret=CLIENT_SECRET
```

Token response:

```json
{"access_token":"ACCESS_TOKEN","token_type":"Bearer","expires_in":3600,"scope":"documents:read documents:write templates:read templates:write account:read webhooks:write offline_access","refresh_token":"REPLACEMENT_REFRESH_TOKEN"}
```

Revocation:

```text
token=CURRENT_ACCESS_TOKEN&token_type_hint=access_token&client_id=CLIENT_ID&client_secret=CLIENT_SECRET
```

Revocation returns HTTP 200 without a resource payload. Invalid client authentication returns 401. Revoking an access token invalidates only that token. Revoking the current refresh token invalidates refresh and its associated access token; later refresh returns `invalid_grant`. Twenty exposes only the access token to this app, so users must remove the authorization in Assinafy Connected apps to end it completely. Twenty's generic revoke request omits the client credentials required by Assinafy, so the app uses its disconnect and uninstall hooks and declares no `revokeEndpoint`.

## Method contracts

The following request and response schemas list the complete payload fields published by Assinafy for these operations. JSON references resolve to the shared schemas later in this document. Schema absence of `required` is preserved; callers still validate IDs and fields they rely on. Provider fields not needed by the app, including signing URLs, are never copied wholesale into Twenty.

### `workspaces.list()`

`GET /v1/accounts`

No body. Returns `{ data: IWorkspaceListItem[], meta }`; OAuth must return exactly one workspace.

Responses:

```json
{
  "200": {
    "description": "The user's accounts",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Account"
                  }
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `templates.list({ page, per_page })`

`GET /v1/accounts/{accountId}/templates`

No body. The SDK converts `per_page` to `per-page` and reads pagination headers into `meta`. The app reads at most four pages of 50 records.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "$ref": "#/components/parameters/Search"
  },
  {
    "$ref": "#/components/parameters/Page"
  },
  {
    "$ref": "#/components/parameters/PerPage"
  }
]
```

Responses:

```json
{
  "200": {
    "description": "A page of templates (default_document_tags omitted in the list)",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Template"
                  }
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `documents.upload({ buffer, fileName }, { name })`

`POST /v1/accounts/{accountId}/documents`

Multipart body: `file` contains the PDF bytes. The SDK applies the optional `name` as the file-part filename, adding `.pdf` when needed; it does not send a separate `name` form part. The app supplies `document.pdf` as the fallback filename and the reviewed document name as the upload option. Files larger than 25 MB or without `%PDF-` are rejected. Returns the unwrapped document.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "multipart/form-data": {
      "schema": {
        "required": [
          "file"
        ],
        "properties": {
          "file": {
            "description": "The PDF file to upload.",
            "type": "string",
            "format": "binary"
          }
        },
        "type": "object"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The created document",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/Document"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ValidationError"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `documents.details(documentId)`

`GET /v1/documents/{documentId}`

No body. The app request interceptor adds `expand=assignment`. Returns the unwrapped document; without expansion the assignment may be absent or null.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/DocumentId"
  }
]
```

Responses:

```json
{
  "200": {
    "description": "The document",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/Document"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "404": {
    "$ref": "#/components/responses/NotFound"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `documents.delete(documentId)`

`DELETE /v1/documents/{documentId}`

No body. Returns void. For cancellation, 404 means already removed; 400 means Assinafy refused the operation. For draft cleanup, account, assignment, status and Twenty references are checked before deletion. Member discard only calls this method after the upload reaches 24 hours; earlier discards succeed while retaining the pending entry for the background purge. Member sends accept uploads younger than 23 hours, leaving one hour before deletion can start. Workflow cleanup of its own definite failed-send upload may delete immediately. Background cleanup requires an API key or shared connection; a personal-only upload can instead be discarded by its member after the TTL while tracked, or removed manually in Assinafy.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/DocumentId"
  }
]
```

Responses:

```json
{
  "200": {
    "description": "Document deleted",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "type": "array",
                  "items": [],
                  "example": []
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "404": {
    "$ref": "#/components/responses/NotFound"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `documents.download(documentId, artifact)`

`GET /v1/documents/{documentId}/download/{artifactName}`

No body. Returns a Buffer of PDF bytes, not a JSON envelope. The app requests `certificated` and, when listed, `pades`; it never fetches provider-supplied signing links.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/DocumentId"
  },
  {
    "name": "artifactName",
    "in": "path",
    "description": "Artifact type.",
    "required": true,
    "schema": {
      "type": "string",
      "enum": [
        "original",
        "certificated",
        "certificate-page",
        "pades",
        "bundle"
      ]
    }
  }
]
```

Responses:

```json
{
  "200": {
    "description": "The artifact binary",
    "content": {
      "application/pdf": {
        "schema": {
          "type": "string",
          "format": "binary"
        }
      }
    }
  },
  "404": {
    "$ref": "#/components/responses/NotFound"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `signers.create(payload)`

`POST /v1/accounts/{accountId}/signers`

Returns the unwrapped signer. An existing email can return the existing signer unchanged; the app then updates changed values.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "required": [
          "full_name"
        ],
        "properties": {
          "full_name": {
            "type": "string",
            "example": "John Dove"
          },
          "email": {
            "type": "string",
            "format": "email",
            "example": "signer@example.invalid"
          },
          "whatsapp_phone_number": {
            "description": "E.164; normalized on save.",
            "type": "string",
            "example": "+5548999990000"
          },
          "government_id": {
            "description": "Signer's CPF (11 digits) or CNPJ (14 characters; may be alphanumeric). Formatting is accepted and the value is normalized on save. Required before the signer can use a verification method that identifies them by CPF.",
            "type": "string",
            "example": "390.533.447-05"
          }
        },
        "type": "object"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The created signer",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/Signer"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ValidationError"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```


SDK lookup before creation:

`GET /v1/accounts/{accountId}/signers?search=<email>`

`signers.create` uses `findByEmail` before the POST and after a duplicate response. The SDK searches pages of 50 until it finds an exact case-insensitive email match or reaches the end. The query is a substring search on the server; only an exact match is reused.

Lookup parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "name": "search",
    "in": "query",
    "description": "Filter by full_name or email.",
    "schema": {
      "type": "string"
    }
  },
  {
    "$ref": "#/components/parameters/Page"
  },
  {
    "$ref": "#/components/parameters/PerPage"
  }
]
```

Lookup responses:

```json
{
  "200": {
    "description": "A page of signers",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Signer"
                  }
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `signers.update(signerId, patch)`

`PUT /v1/accounts/{accountId}/signers/{signerId}`

Returns the unwrapped signer. The app changes full_name, a WhatsApp invitation phone, and government_id for certificate or biometric verification; it never changes email. Channel changes can invalidate earlier links and codes; verified in-flight channels cannot be changed.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "name": "signerId",
    "in": "path",
    "description": "The signer ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "properties": {
          "full_name": {
            "type": "string",
            "example": "John Dove"
          },
          "email": {
            "description": "Can't be changed or cleared while the signer has verified it on an in-flight document (`400`).",
            "type": "string",
            "format": "email",
            "example": "signer@example.invalid"
          },
          "whatsapp_phone_number": {
            "description": "E.164; normalized on save, and compared after normalizing, so the same number in another format is not a change. Can't be changed or cleared while the signer has verified it on an in-flight document (`400`).",
            "type": "string",
            "example": "+5548999990000"
          },
          "government_id": {
            "description": "Signer's CPF (11 digits) or CNPJ (14 characters; may be alphanumeric). Formatting is accepted and the value is normalized on save.",
            "type": "string",
            "example": "390.533.447-05"
          }
        },
        "type": "object"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The updated signer",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/Signer"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ValidationError"
  },
  "404": {
    "$ref": "#/components/responses/NotFound"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `assignments.estimateCost(documentId, payload)`

`POST /v1/documents/{documentId}/assignments/estimate-cost`

Returns an unwrapped cost estimate. The app sends `method: virtual` and verification/notification methods only, with no signer creation or invitation.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/DocumentId"
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "properties": {
          "method": {
            "description": "Send the method you will create the assignment with. With `collect`, a `DigitalCertificate` signer returns `400`, because certificate signing works only on `virtual` assignments.",
            "type": "string",
            "enum": [
              "virtual",
              "collect"
            ],
            "example": "virtual"
          },
          "signers": {
            "description": "Required for `virtual`; each entry may be `{}` to default to Email.",
            "type": "array",
            "items": {
              "properties": {
                "verification_method": {
                  "description": "Verification method to price. `Whatsapp` forces the WhatsApp notification, so it prices at 0.45 credits per signer; `DigitalCertificate` adds the per-signer signature cost on top of its notification, and with `method: collect` returns `400` (certificate signers sign only virtual assignments). `IdDocumentFaceMatchBasic` requires its account feature, requires the signer to have a valid CPF in `government_id`, and is charged your plan's per-signer verification price on top of its notification.",
                  "type": "string",
                  "enum": [
                    "Email",
                    "Whatsapp",
                    "DigitalCertificate",
                    "IdDocumentFaceMatchBasic"
                  ],
                  "example": "Whatsapp"
                },
                "notification_methods": {
                  "description": "The notification channel to price — exactly one per signer, subject to the same pairing rules as **Create assignment**. `Whatsapp` costs 0.45 credits per signer. Omit it to have it inferred from `verification_method`.",
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Email",
                      "Whatsapp"
                    ]
                  }
                }
              },
              "type": "object"
            }
          },
          "entries": {
            "description": "Required for `collect`.",
            "type": "array",
            "items": {
              "type": "object"
            }
          }
        },
        "type": "object"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "Cost estimate and balances",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/CostEstimate"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ValidationError"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `assignments.create(documentId, payload)`

`POST /v1/documents/{documentId}/assignments`

Billable. Returns the unwrapped assignment. Called once, after a unique SENDING record is created and the estimate is checked again. Never retried.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/DocumentId"
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "required": [
          "method",
          "signers"
        ],
        "properties": {
          "method": {
            "description": "`virtual` signs without input fields; `collect` places input fields on pages. Signers with `DigitalCertificate` verification need `virtual` (`collect` returns `400`).",
            "type": "string",
            "enum": [
              "virtual",
              "collect"
            ],
            "example": "virtual"
          },
          "signers": {
            "type": "array",
            "items": {
              "required": [
                "id"
              ],
              "properties": {
                "id": {
                  "type": "string",
                  "example": "615605f50e968054a5b7c9b8"
                },
                "verification_method": {
                  "description": "How the signer's identity is verified before signing. `Email` (default) sends a one-time code to the signer's email; `Whatsapp` sends the code over WhatsApp — the verification itself is not billed, but it requires the WhatsApp notification channel, so the signer costs 0.45 credits (available only on paid subscriptions); `DigitalCertificate` has the signer sign with their own ICP-Brasil certificate (A1/A3) — it requires the Digital Certificate feature, the signer must have a CPF or CNPJ in `government_id`, must be alone in its signing step, needs `method: virtual` (a `collect` assignment with a `DigitalCertificate` signer returns `400`), and is charged 0.5 credits per signer. A CPF requires that person's certificate (an e-CPF, or an e-CNPJ naming them as legal representative); a CNPJ requires an e-CNPJ for that company, from any of its representatives. `IdDocumentFaceMatchBasic` verifies the signer from a photo of their government ID, a photo of them holding it and a liveness check — it requires the ID Document + Face Match feature, the signer must have a valid CPF in `government_id`, and is charged a per-signer fee. Omit to default to `Email`.",
                  "type": "string",
                  "enum": [
                    "Email",
                    "Whatsapp",
                    "DigitalCertificate",
                    "IdDocumentFaceMatchBasic"
                  ],
                  "example": "Email"
                },
                "notification_methods": {
                  "description": "How the signer is told a signature is being requested. **Exactly one method per signer** — the array shape is historical, and sending two returns `400`. The method must also be compatible with `verification_method`: `Email` verification takes `Email`, `Whatsapp` verification takes `Whatsapp`, and `DigitalCertificate` and `IdDocumentFaceMatchBasic` take either. WhatsApp incurs an additional cost and is available only on paid subscriptions. Omit it to have it inferred from `verification_method`, or `{\"Email\"}` when neither is sent. See **Verification & Notification Methods** for the full pairing table.",
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Email",
                      "Whatsapp"
                    ]
                  },
                  "example": [
                    "Email"
                  ]
                },
                "step": {
                  "type": "integer",
                  "example": 1
                }
              },
              "type": "object"
            }
          },
          "entries": {
            "description": "Required for `collect`: field placements per page. In `collect`, every signer listed in `signers` must appear once and own at least one field here; otherwise `400`.",
            "type": "array",
            "items": {
              "properties": {
                "page_id": {
                  "type": "string"
                },
                "fields": {
                  "type": "array",
                  "items": {
                    "properties": {
                      "signer_id": {
                        "type": "string"
                      },
                      "field_id": {
                        "type": "string"
                      },
                      "display_settings": {
                        "$ref": "#/components/schemas/DisplaySettings"
                      }
                    },
                    "type": "object"
                  }
                }
              },
              "type": "object"
            }
          },
          "message": {
            "description": "Text included in the invitation email.",
            "type": "string"
          },
          "expires_at": {
            "description": "ISO 8601; default is no expiration. Must be at least one hour in the future. A UTC offset in the value is honored (`2026-12-31T23:59:59-03:00` is `2027-01-01T02:59:59Z`); a value without one is read as UTC, and a date alone (`2026-12-31`) means 23:59 UTC that day.",
            "type": "string",
            "format": "date-time"
          },
          "copy_receivers": {
            "description": "Signer IDs that only receive a copy.",
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "type": "object"
      },
      "examples": {
        "virtual_full": {
          "$ref": "#/components/examples/AssignmentCreateVirtualFull"
        },
        "collect_full": {
          "$ref": "#/components/examples/AssignmentCreateCollectFull"
        },
        "virtual": {
          "$ref": "#/components/examples/AssignmentCreateVirtual"
        },
        "collect": {
          "$ref": "#/components/examples/AssignmentCreateCollect"
        }
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The created assignment",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/Assignment"
                }
              },
              "type": "object"
            }
          ]
        },
        "examples": {
          "virtual": {
            "$ref": "#/components/examples/AssignmentCreatedVirtual"
          },
          "collect": {
            "$ref": "#/components/examples/AssignmentCreatedCollect"
          }
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ValidationError"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `documents.estimateCostFromTemplate(templateId, signers)`

`POST /v1/accounts/{accountId}/templates/{templateId}/documents/estimate-cost`

Returns an unwrapped cost estimate. Signers carry role_id and verification/notification methods, without contact data. No document is created.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "name": "templateId",
    "in": "path",
    "description": "The template ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "required": [
          "signers"
        ],
        "properties": {
          "signers": {
            "description": "One entry per template role (editor roles are ignored for cost calculation).",
            "type": "array",
            "items": {
              "required": [
                "role_id"
              ],
              "properties": {
                "role_id": {
                  "description": "The template role ID associated with the signer.",
                  "type": "string",
                  "example": "fa8c14f32d732271e071998246e"
                },
                "verification_method": {
                  "description": "Verification method. If provided without notification_methods, the notification method is inferred. Defaults to Email. Verification is never billed on its own — the cost comes from the notification it is paired with, so `Whatsapp` verification requires the WhatsApp notification and costs 0.45 credits per signer. `DigitalCertificate` adds the per-signer signature cost (0.5 credits) on top of the notification cost, and returns `400` when the template has placed signer fields. `IdDocumentFaceMatchBasic` verifies the signer from a photo of their government ID, a photo of them holding it and a liveness check — it requires its account feature, requires the signer to have a valid CPF in `government_id`, and is charged a per-signer fee.",
                  "type": "string",
                  "enum": [
                    "Email",
                    "Whatsapp",
                    "DigitalCertificate",
                    "IdDocumentFaceMatchBasic"
                  ],
                  "example": "Whatsapp"
                },
                "notification_methods": {
                  "description": "Notification method for this signer — exactly one, and it must be compatible with `verification_method`. If provided without verification_method, the verification method is inferred. Defaults to Email.",
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "example": [
                    "Whatsapp"
                  ]
                }
              },
              "type": "object"
            }
          }
        },
        "type": "object"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "Cost estimate",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/CostEstimate"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `documents.createFromTemplate(templateId, signers, options)`

`POST /v1/accounts/{accountId}/templates/{templateId}/documents`

Billable. Returns the unwrapped document. Signers already exist in the account. The app supplies each signer role exactly once, every editor field, name, and optional message/expiration. Never retried. The initial response may have no assignment yet; a subsequent document sync reads it without creating another document.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "name": "templateId",
    "in": "path",
    "description": "The template ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "required": [
          "signers"
        ],
        "properties": {
          "signers": {
            "description": "One entry per template role.",
            "type": "array",
            "items": {
              "required": [
                "role_id"
              ],
              "properties": {
                "role_id": {
                  "description": "The template role ID associated with the signer.",
                  "type": "string",
                  "example": "fa8c14f32d732271e071998246e"
                },
                "id": {
                  "description": "An existing signer's ID. Send either `id` or `email`; `id` wins when both are sent, and an unknown `id` returns `400`.",
                  "type": "string",
                  "example": "fa8c140cb49b79f940aab95fddd"
                },
                "email": {
                  "description": "Used when `id` is not sent: the account's signer with this email is reused, or a new one is created with `name`.",
                  "type": "string",
                  "example": "signer@example.invalid"
                },
                "name": {
                  "description": "Full name for a signer created from `email`.",
                  "type": "string",
                  "example": "Maria Silva"
                },
                "whatsapp_phone_number": {
                  "description": "WhatsApp number for a signer created from `email`.",
                  "type": "string",
                  "example": "+5548999999999"
                },
                "verification_method": {
                  "description": "Verification method for this signer. If provided without notification_methods, the notification method is inferred. Defaults to Email. `DigitalCertificate` has the signer sign with their own ICP-Brasil certificate — it requires the Digital Certificate feature, the signer must have a CPF or CNPJ in `government_id` (a CPF requires that person's certificate; a CNPJ requires an e-CNPJ for that company), must be alone in its signing step, and is charged 0.5 credits per signer. It is refused with `400` when the template has placed signer fields, because certificate signers sign only virtual assignments. `IdDocumentFaceMatchBasic` verifies the signer from a photo of their government ID, a photo of them holding it and a liveness check — it requires the ID Document + Face Match feature, the signer must have a valid CPF in `government_id`, and is charged a per-signer fee. Only applies to signers (not copy receivers).",
                  "type": "string",
                  "enum": [
                    "Email",
                    "Whatsapp",
                    "DigitalCertificate",
                    "IdDocumentFaceMatchBasic"
                  ],
                  "example": "Email"
                },
                "notification_methods": {
                  "description": "Notification method codes for this signer. If provided without verification_method, the verification method is inferred. Defaults to Email. Only one method allowed per signer.",
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "example": [
                    "Email"
                  ]
                },
                "step": {
                  "description": "Positive integer that controls signing order. Signers sharing the same step sign in parallel; a step activates only after every signer in the previous step has signed. If supplied for any role it must be supplied for all, forming a contiguous sequence starting at 1. Copy receivers ignore this field.",
                  "type": "integer",
                  "example": 1
                }
              },
              "type": "object"
            }
          },
          "editor_fields": {
            "description": "Values for the fields placed on the template's `Editor` role, baked into the generated document. The `Editor` role takes no `signers` entry: it is filled only through this list. Every field placed on it needs an entry with a non-empty `value` (`400` otherwise); when it has no fields, send nothing. In `signers`, every `Signer` role needs an entry (`400` otherwise), and a `CopyReceiver` role takes an entry only for someone who should receive the certified document; a copy receiver's `verification_method`, `notification_methods` and `step` are ignored.",
            "type": "array",
            "items": {
              "required": [
                "field_id",
                "value"
              ],
              "properties": {
                "field_id": {
                  "description": "The field identifier, matching the field_id in the template data.",
                  "type": "string",
                  "example": "fa8c14f3af99d2846d1789de4ba"
                },
                "value": {
                  "description": "The value to assign to the field.",
                  "type": "string",
                  "example": "Field value"
                }
              },
              "type": "object"
            }
          },
          "name": {
            "description": "Title for the document. Defaults to the template name.",
            "type": "string",
            "example": "sample-contract-one-page.pdf"
          },
          "message": {
            "description": "Optional message sent to signers.",
            "type": "string",
            "example": "Message to the signers"
          },
          "expires_at": {
            "description": "Assignment expiration date (ISO 8601). No expiration by default. Must be at least one hour in the future. A UTC offset in the value is honored (`2026-12-31T23:59:59-03:00` is `2027-01-01T02:59:59Z`); a value without one is read as UTC, and a date alone (`2026-12-31`) means 23:59 UTC that day.",
            "type": "string",
            "format": "date-time",
            "example": "2024-07-30T23:59:00Z"
          },
          "tags": {
            "description": "Tag names to attach to the new document. Names that don't exist are auto-created. The template's default-document-tags are always applied; values here are merged on top (duplicates removed).",
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "type": "object"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The created document",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/Document"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ValidationError"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `assignments.estimateResendCost(documentId, assignmentId, signerId)`

`POST /v1/documents/{documentId}/assignments/{assignmentId}/signers/{signerId}/estimate-resend-cost`

No body. Returns the current cost estimate or the SDK-supported legacy resend shape below. The app checks the quote before confirmation and again before the resend.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/DocumentId"
  },
  {
    "name": "assignmentId",
    "in": "path",
    "description": "The assignment ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  },
  {
    "name": "signerId",
    "in": "path",
    "description": "The signer ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```

Responses:

```json
{
  "200": {
    "description": "Cost estimate",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/ResendCostEstimate"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `assignments.resendNotification(documentId, assignmentId, signerId)`

`PUT /v1/documents/{documentId}/assignments/{assignmentId}/signers/{signerId}/resend`

No body. Billable. Returns `{ is_sent, document_id, signer_id }`; only a boolean true confirms delivery. Never retried.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/DocumentId"
  },
  {
    "name": "assignmentId",
    "in": "path",
    "description": "The assignment ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  },
  {
    "name": "signerId",
    "in": "path",
    "description": "The signer ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```

Responses:

```json
{
  "200": {
    "description": "Resend result",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "properties": {
                    "is_sent": {
                      "type": "boolean"
                    },
                    "document_id": {
                      "type": "string"
                    },
                    "signer_id": {
                      "type": "string"
                    }
                  },
                  "type": "object"
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "400": {
    "description": "The document is not pending signature, the signer is not part of the assignment, has already signed, or waits for an earlier signing step; or the account lacks credits for the reminder."
  },
  "404": {
    "description": "The assignment or signer was not found on this document."
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `webhooks.listEndpoints()`

`GET /v1/accounts/{accountId}/webhooks/endpoints`

Returns the unwrapped list of endpoints, oldest first. The cron reads it once per Assinafy workspace while webhooks are on, to find the endpoint it stored and any endpoint at its own route it no longer knows. OAuth tokens need `account:read`.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "name": "url",
    "in": "query",
    "description": "Only the endpoint registered with exactly this URL.",
    "required": false,
    "schema": {
      "type": "string",
      "format": "uri"
    },
    "example": "https://example.com/webhooks/assinafy"
  }
]
```

Responses:

```json
{
  "200": {
    "description": "The endpoints",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/WebhookEndpoint"
                  }
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `webhooks.createEndpoint(payload)`

`POST /v1/accounts/{accountId}/webhooks/endpoints`

Returns the created endpoint. The app sends `name: "Twenty"`, the route URL with its `token` query parameter, the contact email from `ASSINAFY_WEBHOOK_EMAIL`, the events in `WEBHOOK_EVENTS` and `signing_enabled: true` with both API keys and OAuth connections. The creation response includes `secret` once; the app stores it with the endpoint and verifies every delivery. A missing secret fails registration; the next reconciliation replaces the orphan. Legacy unsigned OAuth endpoints and endpoints with signatures disabled are replaced with signed endpoints. Accounts allow one endpoint on free plans and up to three on paid plans; the app uses one slot and leaves other URLs alone. A 403 (no free endpoint slot, or a connection without `webhooks:write`) is logged and the workspace keeps polling. OAuth tokens need `webhooks:write`.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "required": [
          "url",
          "email",
          "events"
        ],
        "properties": {
          "url": {
            "description": "URL that receives the events: `https` for a new or changed URL (a URL stored before keeps working). Its host must resolve to a public address; private, loopback, link-local and other reserved addresses are refused with `400`. Deliveries don't follow redirects: a `3xx` answer counts as a failed delivery.",
            "type": "string",
            "format": "uri",
            "example": "https://example.com/webhooks/assinafy"
          },
          "email": {
            "description": "Contact email for delivery-failure notices.",
            "type": "string",
            "format": "email",
            "example": "signer@example.invalid"
          },
          "events": {
            "description": "Event types to deliver (see `GET /v1/webhooks/event-types`).",
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "document_ready",
              "signer_signed_document"
            ]
          },
          "name": {
            "description": "Label to tell endpoints apart.",
            "type": "string",
            "example": "ERP"
          },
          "is_active": {
            "description": "Whether events are delivered. Defaults to `true`.",
            "type": "boolean",
            "example": true
          },
          "signing_enabled": {
            "description": "Sign deliveries with a Standard Webhooks signature. Defaults to `false`.",
            "type": "boolean",
            "example": true
          }
        },
        "type": "object"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The created endpoint",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "type": "object",
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/WebhookEndpoint"
                    },
                    {
                      "properties": {
                        "secret": {
                          "description": "Standard Webhooks signing secret: `whsec_` followed by the base64-encoded key. Present only when `signing_enabled` is `true`.",
                          "type": "string",
                          "example": "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"
                        }
                      },
                      "type": "object"
                    }
                  ]
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ValidationError"
  },
  "403": {
    "$ref": "#/components/responses/Forbidden",
    "description": "The account already has as many endpoints as its plan allows."
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `webhooks.updateEndpoint(endpointId, patch)`

`PUT /v1/accounts/{accountId}/webhooks/endpoints/{endpointId}`

Returns the updated endpoint. Sent only when the stored endpoint drifted: another route URL, another contact email, other events or deactivated; the app sends `url`, `email`, `events` and `is_active: true`. OAuth tokens need `webhooks:write`.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "name": "endpointId",
    "in": "path",
    "description": "The webhook endpoint ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "properties": {
          "url": {
            "type": "string",
            "format": "uri",
            "example": "https://example.com/webhooks/assinafy"
          },
          "email": {
            "type": "string",
            "format": "email",
            "example": "signer@example.invalid"
          },
          "events": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "document_ready"
            ]
          },
          "name": {
            "type": "string",
            "example": "ERP"
          },
          "is_active": {
            "type": "boolean",
            "example": false
          },
          "signing_enabled": {
            "type": "boolean",
            "example": true
          }
        },
        "type": "object"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The updated endpoint",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "type": "object",
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/WebhookEndpoint"
                    },
                    {
                      "properties": {
                        "secret": {
                          "description": "Standard Webhooks signing secret: `whsec_` followed by the base64-encoded key. Present only when this request turned signing on.",
                          "type": "string",
                          "example": "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"
                        }
                      },
                      "type": "object"
                    }
                  ]
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ValidationError"
  },
  "404": {
    "$ref": "#/components/responses/NotFound"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `webhooks.deleteEndpoint(endpointId)`

`DELETE /v1/accounts/{accountId}/webhooks/endpoints/{endpointId}`

No body. Frees the slot. Used when webhooks are turned off, on uninstall, and for endpoints at the app's route that are not the stored one. Endpoints at other URLs are never deleted. OAuth tokens need `webhooks:write`.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "name": "endpointId",
    "in": "path",
    "description": "The webhook endpoint ID.",
    "required": true,
    "schema": {
      "type": "string"
    }
  }
]
```

Responses:

```json
{
  "200": {
    "description": "Endpoint deleted",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "type": "array",
                  "items": [],
                  "example": []
                }
              },
              "type": "object"
            }
          ]
        }
      }
    }
  },
  "404": {
    "$ref": "#/components/responses/NotFound"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `oauth.revokeToken({ token, tokenTypeHint, clientId, clientSecret })`

`POST /v1/oauth/revoke`

Form-encoded; tokenTypeHint maps to token_type_hint and clientId/clientSecret to client_id/client_secret. Returns void. Uses the current access token because Twenty does not expose refresh tokens to the app. Access-token revocation blocks the supplied access token but leaves its refresh token usable. Revoke the authorization in Assinafy Connected apps to end the connection completely. No retries; failures are logged by error name only.

Request body:

```json
{
  "required": true,
  "content": {
    "application/x-www-form-urlencoded": {
      "schema": {
        "$ref": "#/components/schemas/OAuthRevokeRequest"
      }
    },
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/OAuthRevokeRequest"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "Revoked"
  },
  "401": {
    "description": "`invalid_client` — the only case that is not reported as success. Every token outcome (revoked, already revoked, unknown, malformed) always returns 200; only failed client authentication returns 401.",
    "content": {
      "application/json": {
        "schema": {
          "properties": {
            "error": {
              "type": "string",
              "example": "invalid_client"
            },
            "error_description": {
              "type": "string",
              "example": "Client authentication failed."
            }
          },
          "type": "object"
        }
      }
    }
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

### `OAuth token exchange and refresh (managed by Twenty)`

`POST /v1/oauth/token`

Twenty sends form-encoded authorization_code or refresh_token requests, validates its state, stores tokens, and rotates the refresh token. The app does not implement another callback or token store.

Request body:

```json
{
  "required": true,
  "content": {
    "application/x-www-form-urlencoded": {
      "schema": {
        "$ref": "#/components/schemas/OAuthTokenRequest"
      }
    },
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/OAuthTokenRequest"
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The token response",
    "content": {
      "application/json": {
        "schema": {
          "properties": {
            "access_token": {
              "type": "string"
            },
            "issued_token_type": {
              "description": "Present only for the token-exchange grant, per RFC 8693 §2.2.1.",
              "type": "string",
              "example": "urn:ietf:params:oauth:token-type:access_token"
            },
            "token_type": {
              "type": "string",
              "example": "Bearer"
            },
            "expires_in": {
              "description": "For the token-exchange grant, clamped to the subject token's own remaining lifetime as well as the exchanged-token TTL — never longer than either.",
              "type": "integer",
              "example": 3600
            },
            "refresh_token": {
              "description": "Present only when the `offline_access` scope was requested AND consented on the authorization_code/refresh_token grants. Never present for the token-exchange grant. Without it a client must send the user through the authorization flow again once the access token expires.",
              "type": [
                "string",
                "null"
              ]
            },
            "scope": {
              "description": "The scope of the ACCESS token. `offline_access` is a request-time signal rather than a permission, so it never appears here even when it was requested.",
              "type": "string",
              "example": "documents:read"
            },
            "id_token": {
              "description": "A signed OIDC id_token (RS256). Present only when the openid scope was granted.",
              "type": [
                "string",
                "null"
              ]
            }
          },
          "type": "object"
        }
      }
    }
  },
  "400": {
    "description": "`invalid_grant` (bad, expired, replayed, or wrong-client authorization code; a `code_verifier` outside the RFC 7636 grammar of 43-128 unreserved characters; redirect_uri mismatch; a refresh token whose authorization no longer includes `offline_access`; for token-exchange, a `subject_token` that is unusable, itself an exchanged token, not visible to service clients, or expired), `invalid_target` (a `resource` this server does not issue tokens for, one disagreeing with the authorized value, or — for token-exchange — one other than this API's own resource identifier), `invalid_scope` (token-exchange only: the requested `scope` is not a subset of the subject token's own scopes), `invalid_request` (token-exchange only: an unsupported `subject_token_type`/`requested_token_type`), or `unsupported_grant_type`",
    "content": {
      "application/json": {
        "schema": {
          "properties": {
            "error": {
              "type": "string",
              "enum": [
                "invalid_grant",
                "invalid_target",
                "invalid_scope",
                "invalid_request",
                "unsupported_grant_type"
              ]
            },
            "error_description": {
              "type": "string"
            }
          },
          "type": "object"
        }
      }
    }
  },
  "401": {
    "description": "`invalid_client` — unknown/disabled client or failed client authentication. The description never reveals whether client_id exists.",
    "content": {
      "application/json": {
        "schema": {
          "properties": {
            "error": {
              "type": "string",
              "example": "invalid_client"
            },
            "error_description": {
              "type": "string",
              "example": "Client authentication failed."
            }
          },
          "type": "object"
        }
      }
    }
  },
  "429": {
    "description": "Rate limit exceeded; wait the `Retry-After` seconds. Limited per caller IP."
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```


### `contracts.get(documentId)`

`GET /v1/accounts/{accountId}/documents/{documentId}/contract`

No body. Returns `IDocumentContract | IDocumentContractAmendment` unwrapped. A root contract includes its related instruments in `amendments`; an instrument returns its link and proposed or applied changes. The read remains available after the workspace loses its contract-tracking plan. OAuth requires `documents:read`. The Twenty panel edits root contracts only; an instrument is shown as a read-only summary. The app never persists contract taxpayer IDs, metadata or raw provider payloads in Twenty.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "$ref": "#/components/parameters/DocumentId"
  }
]
```

Responses:

```json
{
  "200": {
    "description": "The contract terms, or the amendment",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/DocumentContract"
                    },
                    {
                      "$ref": "#/components/schemas/DocumentContractAmendment"
                    }
                  ]
                }
              },
              "type": "object"
            }
          ]
        },
        "examples": {
          "contract": {
            "$ref": "#/components/examples/ContractWithAmendments"
          },
          "amendment": {
            "$ref": "#/components/examples/ContractAmendmentPending"
          }
        }
      }
    }
  },
  "404": {
    "$ref": "#/components/responses/NoContractTerms"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```


### `contracts.set(documentId, payload)`

`PUT /v1/accounts/{accountId}/documents/{documentId}/contract`

Creates root terms or changes only supplied attributes. Returns the saved root contract or amendment link unwrapped. OAuth requires `documents:write`, and a contract-tracking plan is required. The app manages root terms; the complete upstream schema below also describes instrument links, which are managed in Assinafy. Omitted fields are preserved; `external_references`, when sent, replaces the whole list.

When updating existing terms, send their `updated_at` exactly as read; a concurrent change returns HTTP 409 with `code: ContractChanged` and writes nothing. New terms have no previous timestamp, so omit it. The API compares timestamps to the second. A changed `end_date` starts a new `term`. Existing active contracts cannot go back to draft; lifecycle expiration and the dedicated termination endpoint close them, and renewal reopens an expired contract.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "$ref": "#/components/parameters/DocumentId"
  }
]
```

Request body:

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/DocumentContractInput"
      },
      "examples": {
        "full": {
          "$ref": "#/components/examples/ContractUpdateFull"
        },
        "partial": {
          "$ref": "#/components/examples/ContractUpdatePartial"
        },
        "references": {
          "$ref": "#/components/examples/ContractUpdateReferences"
        },
        "link": {
          "$ref": "#/components/examples/ContractAmendmentLink"
        }
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The contract terms as saved, or the amendment as linked",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "oneOf": [
                    {
                      "$ref": "#/components/schemas/DocumentContract"
                    },
                    {
                      "$ref": "#/components/schemas/DocumentContractAmendment"
                    }
                  ]
                }
              },
              "type": "object"
            }
          ]
        },
        "examples": {
          "contract": {
            "$ref": "#/components/examples/Contract"
          },
          "amendmentPending": {
            "$ref": "#/components/examples/ContractAmendmentPending"
          },
          "amendmentApplied": {
            "$ref": "#/components/examples/ContractAmendmentApplied"
          }
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ContractInputError"
  },
  "403": {
    "description": "The workspace's plan does not include contract tracking.",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/ErrorEnvelope"
            },
            {
              "properties": {
                "status": {
                  "type": "integer",
                  "example": 403
                },
                "message": {
                  "type": "string",
                  "example": "Contract tracking is not available for your current plan."
                }
              },
              "type": "object"
            }
          ]
        },
        "example": {
          "status": 403,
          "message": "Contract tracking is not available for your current plan."
        }
      }
    }
  },
  "409": {
    "$ref": "#/components/responses/ContractChanged"
  },
  "404": {
    "description": "The document is not in the workspace, the `parent_document_id` names a document outside it, or `parent_document_id: null` is sent for a document that is not an amendment.",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/ErrorEnvelope"
            },
            {
              "properties": {
                "status": {
                  "type": "integer",
                  "example": 404
                },
                "message": {
                  "type": "string",
                  "example": "Document not found."
                }
              },
              "type": "object"
            }
          ]
        },
        "example": {
          "status": 404,
          "message": "Document not found."
        }
      }
    }
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```


### `contracts.renew(documentId, payload)`

`POST /v1/accounts/{accountId}/documents/{documentId}/contract/renew`

Starts the next term and returns `IDocumentContract` unwrapped. OAuth requires `documents:write` and a contract-tracking plan. The app sends the current `term` and `updated_at`. Without a new `end_date`, renewal advances the current date by `renewal_term_months` (12 when unset). An explicit date must be later than the current end date; an optional `value` changes the amount. Renewal increments `term`, reopens an expired contract and starts its lifecycle alerts again; a terminated contract cannot be renewed.

The original term/date and concurrency timestamp must be kept after an uncertain response. Repeating those values cannot advance another term: the API refuses the stale term/date with HTTP 400 or the stale timestamp with HTTP 409. Read the terms again to establish the result before proposing another renewal.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "$ref": "#/components/parameters/DocumentId"
  }
]
```

Request body:

```json
{
  "required": false,
  "content": {
    "application/json": {
      "schema": {
        "properties": {
          "end_date": {
            "description": "The new end date, after the current one. Absent, empty or `null`: the current end date plus the renewal term, stepped until it is in the future; `term` is then required.",
            "type": [
              "string",
              "null"
            ],
            "format": "date"
          },
          "value": {
            "description": "The new value; unchanged when not sent, cleared by `null`.",
            "type": [
              "number",
              "null"
            ]
          },
          "term": {
            "description": "The term this renewal starts from, the contract's current `term`. Required unless `end_date` is sent; for a contract in another term the renewal is refused, so a repeated request never renews twice.",
            "type": "integer",
            "minimum": 1,
            "example": 1
          },
          "updated_at": {
            "description": "Optional precondition: the contract's `updated_at` as read. Changed since: `409`, nothing renewed.",
            "type": "string",
            "format": "date-time",
            "example": "2026-10-23T12:00:00Z"
          }
        },
        "type": "object"
      },
      "examples": {
        "by_term": {
          "$ref": "#/components/examples/ContractRenewByTerm"
        },
        "explicit": {
          "$ref": "#/components/examples/ContractRenewExplicit"
        }
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The renewed contract",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/DocumentContract"
                }
              },
              "type": "object"
            }
          ]
        },
        "examples": {
          "renewed": {
            "$ref": "#/components/examples/ContractRenewed"
          }
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ContractInputError"
  },
  "403": {
    "description": "The workspace's plan does not include contract tracking.",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/ErrorEnvelope"
            },
            {
              "properties": {
                "status": {
                  "type": "integer",
                  "example": 403
                },
                "message": {
                  "type": "string",
                  "example": "Contract tracking is not available for your current plan."
                }
              },
              "type": "object"
            }
          ]
        },
        "example": {
          "status": 403,
          "message": "Contract tracking is not available for your current plan."
        }
      }
    }
  },
  "409": {
    "$ref": "#/components/responses/ContractChanged"
  },
  "404": {
    "$ref": "#/components/responses/NoContractTerms"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```


### `contracts.terminate(documentId, payload)`

`POST /v1/accounts/{accountId}/documents/{documentId}/contract/terminate`

Closes the contract and returns `IDocumentContract` unwrapped. OAuth requires `documents:write` and a contract-tracking plan. The optional `reason` is recorded in Assinafy’s document activity. Send the last-read `updated_at` to reject a concurrent change with HTTP 409. Termination stops contract lifecycle alerts; it does not delete the document or cancel a signature assignment.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "$ref": "#/components/parameters/DocumentId"
  }
]
```

Request body:

```json
{
  "required": false,
  "content": {
    "application/json": {
      "schema": {
        "properties": {
          "reason": {
            "description": "Kept in the `document_contract_terminated` event; HTML is stripped.",
            "type": [
              "string",
              "null"
            ],
            "maxLength": 500
          },
          "updated_at": {
            "description": "Optional precondition: the contract's `updated_at` as read. Changed since: `409`, nothing terminated.",
            "type": "string",
            "format": "date-time",
            "example": "2026-10-23T12:00:00Z"
          }
        },
        "type": "object"
      },
      "examples": {
        "with_reason": {
          "$ref": "#/components/examples/ContractTerminate"
        }
      }
    }
  }
}
```

Responses:

```json
{
  "200": {
    "description": "The terminated contract",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/Envelope"
            },
            {
              "properties": {
                "data": {
                  "$ref": "#/components/schemas/DocumentContract"
                }
              },
              "type": "object"
            }
          ]
        },
        "examples": {
          "terminated": {
            "$ref": "#/components/examples/ContractTerminated"
          }
        }
      }
    }
  },
  "400": {
    "$ref": "#/components/responses/ContractInputError"
  },
  "403": {
    "description": "The workspace's plan does not include contract tracking.",
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "allOf": [
            {
              "$ref": "#/components/schemas/ErrorEnvelope"
            },
            {
              "properties": {
                "status": {
                  "type": "integer",
                  "example": 403
                },
                "message": {
                  "type": "string",
                  "example": "Contract tracking is not available for your current plan."
                }
              },
              "type": "object"
            }
          ]
        },
        "example": {
          "status": 403,
          "message": "Contract tracking is not available for your current plan."
        }
      }
    }
  },
  "409": {
    "$ref": "#/components/responses/ContractChanged"
  },
  "404": {
    "$ref": "#/components/responses/NoContractTerms"
  },
  "401": {
    "$ref": "#/components/responses/Unauthorized"
  },
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

## Shared payload schemas

### `examples/AssignmentCreateCollect`

```json
{
  "summary": "Create with input fields (method: collect)",
  "value": {
    "method": "collect",
    "signers": [
      {
        "id": "61521202f665dffcef5f6b24",
        "step": 1
      },
      {
        "id": "615212039529a822e24b6913",
        "step": 2
      }
    ],
    "entries": [
      {
        "page_id": "615213ed81b071f4293b2fc2",
        "fields": [
          {
            "signer_id": "61521202f665dffcef5f6b24",
            "field_id": "6152120297080d55bdd13197",
            "display_settings": {
              "left": 69,
              "top": 282,
              "width": 421,
              "height": 45.86,
              "fontFamily": "Arial",
              "fontSize": 18,
              "backgroundColor": "rgb(185, 218, 255)"
            }
          },
          {
            "signer_id": "615212039529a822e24b6913",
            "field_id": "6152120297080d55bdd13197",
            "display_settings": {
              "left": 639,
              "top": 285,
              "width": 421,
              "height": 45.86,
              "fontFamily": "Arial",
              "fontSize": 18,
              "backgroundColor": "rgb(195, 230, 203)"
            }
          }
        ]
      }
    ],
    "expires_at": "2021-09-30T21:00:00Z"
  }
}
```

### `examples/AssignmentCreateCollectFull`

```json
{
  "summary": "Create with input fields (method: collect, with verification & notification methods)",
  "value": {
    "method": "collect",
    "signers": [
      {
        "id": "61521202f665dffcef5f6b24",
        "verification_method": "Email",
        "notification_methods": [
          "Email"
        ],
        "step": 1
      },
      {
        "id": "615212039529a822e24b6913",
        "verification_method": "Whatsapp",
        "notification_methods": [
          "Whatsapp"
        ],
        "step": 2
      }
    ],
    "entries": [
      {
        "page_id": "615213ed81b071f4293b2fc2",
        "fields": [
          {
            "signer_id": "61521202f665dffcef5f6b24",
            "field_id": "6152120297080d55bdd13197",
            "display_settings": {
              "left": 69,
              "top": 282,
              "width": 421,
              "height": 45.86,
              "fontFamily": "Arial",
              "fontSize": 18,
              "backgroundColor": "rgb(185, 218, 255)"
            }
          },
          {
            "signer_id": "615212039529a822e24b6913",
            "field_id": "6152120297080d55bdd13197",
            "display_settings": {
              "left": 639,
              "top": 285,
              "width": 421,
              "height": 45.86,
              "fontFamily": "Arial",
              "fontSize": 18,
              "backgroundColor": "rgb(195, 230, 203)"
            }
          }
        ]
      }
    ],
    "expires_at": "2021-09-30T21:00:00Z"
  }
}
```

### `examples/AssignmentCreateVirtual`

```json
{
  "summary": "Create without input (method: virtual)",
  "value": {
    "method": "virtual",
    "signers": [
      {
        "id": "615605f50e968054a5b7c9b8",
        "step": 1
      },
      {
        "id": "615605f50e968054a5b7c9b9",
        "step": 2
      }
    ],
    "expires_at": "2021-09-30T21:00:00Z"
  }
}
```

### `examples/AssignmentCreateVirtualFull`

```json
{
  "summary": "Create without input (method: virtual, with verification & notification methods)",
  "value": {
    "method": "virtual",
    "signers": [
      {
        "id": "615605f50e968054a5b7c9b8",
        "verification_method": "Email",
        "notification_methods": [
          "Email"
        ],
        "step": 1
      },
      {
        "id": "615605f50e968054a5b7c9b9",
        "verification_method": "Whatsapp",
        "notification_methods": [
          "Whatsapp"
        ],
        "step": 2
      }
    ],
    "expires_at": "2021-09-30T21:00:00Z"
  }
}
```

### `examples/AssignmentCreatedCollect`

```json
{
  "summary": "Collect assignment created",
  "value": {
    "status": 200,
    "message": "",
    "data": {
      "resource": "assignment",
      "id": "615606ef81d199996981dbce",
      "sender_email": "signer@example.invalid",
      "method": "collect",
      "expires_at": "2021-09-30T21:00:00Z",
      "message": null,
      "signers": [
        {
          "id": "61521202f665dffcef5f6b24",
          "full_name": "Kennith Kuphal",
          "email": "signer@example.invalid",
          "verification_method": "Email",
          "notification_methods": [
            "Email"
          ],
          "step": 1,
          "notified": true,
          "completed": false
        },
        {
          "id": "615212039529a822e24b6913",
          "full_name": "Sonny Bayer",
          "email": "signer@example.invalid",
          "verification_method": "Whatsapp",
          "notification_methods": [
            "Whatsapp"
          ],
          "step": 2,
          "notified": false,
          "completed": false
        }
      ],
      "copy_receivers": [],
      "items": [
        {
          "id": "615606efbb67641186c12330",
          "page": {
            "id": "615213ed81b071f4293b2fc2",
            "number": 1,
            "height": 2100,
            "width": 1275,
            "download_url": "https://api.assinafy.com.br/v1/documents/615213edf8a58f132e1b2384/pages/615213ed81b071f4293b2fc2/download"
          },
          "signer": {
            "id": "61521202f665dffcef5f6b24",
            "full_name": "Kennith Kuphal",
            "email": "signer@example.invalid"
          },
          "field": {
            "id": "6152120297080d55bdd13197",
            "name": "Signature",
            "type": "signature"
          },
          "display_settings": {
            "top": 282,
            "left": 69,
            "width": 421,
            "height": 45.86,
            "fontSize": 18,
            "fontFamily": "Arial",
            "backgroundColor": "rgb(185, 218, 255)"
          },
          "value": null,
          "completed": false
        },
        {
          "id": "615606efcde1a39c9d21e30e",
          "page": {
            "id": "615213ed81b071f4293b2fc2",
            "number": 1,
            "height": 2100,
            "width": 1275,
            "download_url": "https://api.assinafy.com.br/v1/documents/615213edf8a58f132e1b2384/pages/615213ed81b071f4293b2fc2/download"
          },
          "signer": {
            "id": "615212039529a822e24b6913",
            "full_name": "Sonny Bayer",
            "email": "signer@example.invalid"
          },
          "field": {
            "id": "6152120297080d55bdd13197",
            "name": "Signature",
            "type": "signature"
          },
          "display_settings": {
            "top": 285,
            "left": 639,
            "width": 421,
            "height": 45.86,
            "fontSize": 18,
            "fontFamily": "Arial",
            "backgroundColor": "rgb(195, 230, 203)"
          },
          "value": null,
          "completed": false
        }
      ],
      "summary": {
        "signer_count": 2,
        "completed_count": 0,
        "signers": [
          {
            "id": "61521202f665dffcef5f6b24",
            "full_name": "Kennith Kuphal",
            "email": "signer@example.invalid",
            "completed": false
          },
          {
            "id": "615212039529a822e24b6913",
            "full_name": "Sonny Bayer",
            "email": "signer@example.invalid",
            "completed": false
          }
        ]
      },
      "signing_urls": [
        {
          "signer_id": "61521202f665dffcef5f6b24",
          "url": "https:signer@example.invalid"
        },
        {
          "signer_id": "615212039529a822e24b6913",
          "url": "https:signer@example.invalid"
        }
      ]
    }
  }
}
```

### `examples/AssignmentCreatedVirtual`

```json
{
  "summary": "Virtual assignment created",
  "value": {
    "status": 200,
    "message": "",
    "data": {
      "resource": "assignment",
      "id": "615605f8f0cc742d680c62c5",
      "sender_email": "signer@example.invalid",
      "method": "virtual",
      "expires_at": "2021-09-30T21:00:00Z",
      "message": null,
      "signers": [
        {
          "id": "615605f50e968054a5b7c9b8",
          "full_name": "John Dove",
          "email": "signer@example.invalid",
          "verification_method": "Email",
          "notification_methods": [
            "Email"
          ],
          "step": 1,
          "notified": true,
          "completed": false
        },
        {
          "id": "615605f50e968054a5b7c9b9",
          "full_name": "Jane Doe",
          "email": "signer@example.invalid",
          "verification_method": "Whatsapp",
          "notification_methods": [
            "Whatsapp"
          ],
          "step": 2,
          "notified": false,
          "completed": false
        }
      ],
      "copy_receivers": [],
      "items": [
        {
          "id": "615605f8e4a097c44247bd8e",
          "page": null,
          "signer": {
            "id": "615605f50e968054a5b7c9b8",
            "full_name": "John Dove",
            "email": "signer@example.invalid"
          },
          "field": {
            "id": "61521202f2f86152752c6a1b",
            "name": "Virtual",
            "type": "virtual"
          },
          "display_settings": [],
          "value": null,
          "completed": false
        }
      ],
      "summary": {
        "signer_count": 2,
        "completed_count": 0,
        "signers": [
          {
            "id": "615605f50e968054a5b7c9b8",
            "full_name": "John Dove",
            "email": "signer@example.invalid",
            "completed": false
          },
          {
            "id": "615605f50e968054a5b7c9b9",
            "full_name": "Jane Doe",
            "email": "signer@example.invalid",
            "completed": false
          }
        ]
      },
      "signing_urls": [
        {
          "signer_id": "615605f50e968054a5b7c9b8",
          "url": "https:signer@example.invalid"
        },
        {
          "signer_id": "615605f50e968054a5b7c9b9",
          "url": "https:signer@example.invalid"
        }
      ]
    }
  }
}
```

### `examples/Contract`

```json
{
  "summary": "The contract terms",
  "value": {
    "status": 200,
    "message": "",
    "data": {
      "resource": "document_contract",
      "document_id": "66b2f0e1c3a4d5e6f7a8b9c0",
      "status": "active",
      "counterparty_name": "Acme Ltda",
      "counterparty_taxpayer_id": "11222333000181",
      "value": 120000.5,
      "currency": "BRL",
      "start_date": "2026-11-01",
      "end_date": "2027-10-31",
      "auto_renew": true,
      "renewal_term_months": 12,
      "notice_period_days": 30,
      "term": 1,
      "owner_id": "d6zqpbyog2v3xvxerwn8la94",
      "metadata": {
        "crm_stage": "won"
      },
      "external_references": [
        {
          "system": "hubspot",
          "id": "98765"
        }
      ],
      "created_at": "2026-10-23T12:00:00Z",
      "updated_at": "2026-10-23T12:00:00Z"
    }
  }
}
```

### `examples/ContractAmendmentApplied`

```json
{
  "summary": "The amendment, applied to the parent",
  "value": {
    "status": 200,
    "message": "",
    "data": {
      "resource": "document_contract_amendment",
      "document_id": "7c3d1e2f4a5b6c7d8e9f0a1b",
      "document_name": "Aditivo 1 - Contrato de prestação de serviços.pdf",
      "parent_document_id": "66b2f0e1c3a4d5e6f7a8b9c0",
      "relation_type": "amendment",
      "number": 1,
      "status": "applied",
      "document_status": "certificated",
      "apply_error": null,
      "currency": "BRL",
      "terms": {
        "value": 130000,
        "end_date": "2028-06-30"
      },
      "changes": {
        "value": {
          "from": 120000.5,
          "to": 130000
        },
        "end_date": {
          "from": "2027-10-31",
          "to": "2028-06-30"
        },
        "term": {
          "from": 1,
          "to": 2
        }
      },
      "applied_at": "2027-05-12T18:20:00Z",
      "created_at": "2027-05-10T15:00:00Z",
      "updated_at": "2027-05-12T18:20:00Z"
    }
  }
}
```

### `examples/ContractAmendmentLink`

```json
{
  "summary": "Link an aditivo that changes the value and the end date",
  "value": {
    "parent_document_id": "66b2f0e1c3a4d5e6f7a8b9c0",
    "relation_type": "amendment",
    "value": 130000,
    "end_date": "2028-06-30"
  }
}
```

### `examples/ContractAmendmentPending`

```json
{
  "summary": "The amendment, waiting for its signature",
  "value": {
    "status": 200,
    "message": "",
    "data": {
      "resource": "document_contract_amendment",
      "document_id": "7c3d1e2f4a5b6c7d8e9f0a1b",
      "document_name": "Aditivo 1 - Contrato de prestação de serviços.pdf",
      "parent_document_id": "66b2f0e1c3a4d5e6f7a8b9c0",
      "relation_type": "amendment",
      "number": null,
      "status": "pending",
      "document_status": "pending_signature",
      "apply_error": null,
      "currency": "BRL",
      "terms": {
        "value": 130000,
        "end_date": "2028-06-30"
      },
      "changes": {
        "value": {
          "from": 120000.5,
          "to": 130000
        },
        "end_date": {
          "from": "2027-10-31",
          "to": "2028-06-30"
        },
        "term": {
          "from": 1,
          "to": 2
        }
      },
      "applied_at": null,
      "created_at": "2027-05-10T15:00:00Z",
      "updated_at": "2027-05-10T15:00:00Z"
    }
  }
}
```

### `examples/ContractRenewByTerm`

```json
{
  "summary": "Renew from term 1 by the renewal term, with a new value: safe to repeat",
  "value": {
    "term": 1,
    "value": 126000
  }
}
```

### `examples/ContractRenewExplicit`

```json
{
  "summary": "Renew to a date with a new value",
  "value": {
    "end_date": "2029-06-30",
    "value": 130000
  }
}
```

### `examples/ContractRenewed`

```json
{
  "summary": "The renewed contract",
  "value": {
    "status": 200,
    "message": "",
    "data": {
      "resource": "document_contract",
      "document_id": "66b2f0e1c3a4d5e6f7a8b9c0",
      "status": "active",
      "counterparty_name": "Acme Ltda",
      "counterparty_taxpayer_id": "11222333000181",
      "value": 130000,
      "currency": "BRL",
      "start_date": "2026-11-01",
      "end_date": "2029-06-30",
      "auto_renew": true,
      "renewal_term_months": 12,
      "notice_period_days": 30,
      "term": 2,
      "owner_id": "d6zqpbyog2v3xvxerwn8la94",
      "metadata": {
        "crm_stage": "won"
      },
      "external_references": [
        {
          "system": "hubspot",
          "id": "98765"
        }
      ],
      "created_at": "2026-10-23T12:00:00Z",
      "updated_at": "2027-10-15T09:30:00Z"
    }
  }
}
```

### `examples/ContractTerminate`

```json
{
  "summary": "Terminate with a reason",
  "value": {
    "reason": "Fornecedor substituído"
  }
}
```

### `examples/ContractTerminated`

```json
{
  "summary": "The terminated contract",
  "value": {
    "status": 200,
    "message": "",
    "data": {
      "resource": "document_contract",
      "document_id": "66b2f0e1c3a4d5e6f7a8b9c0",
      "status": "terminated",
      "counterparty_name": "Acme Ltda",
      "counterparty_taxpayer_id": "11222333000181",
      "value": 120000.5,
      "currency": "BRL",
      "start_date": "2026-11-01",
      "end_date": "2027-10-31",
      "auto_renew": true,
      "renewal_term_months": 12,
      "notice_period_days": 30,
      "term": 1,
      "owner_id": "d6zqpbyog2v3xvxerwn8la94",
      "metadata": {
        "crm_stage": "won"
      },
      "external_references": [
        {
          "system": "hubspot",
          "id": "98765"
        }
      ],
      "created_at": "2026-10-23T12:00:00Z",
      "updated_at": "2027-03-02T14:00:00Z"
    }
  }
}
```

### `examples/ContractUpdateFull`

```json
{
  "summary": "Set every term",
  "value": {
    "status": "active",
    "counterparty_name": "Acme Ltda",
    "counterparty_taxpayer_id": "11.222.333/0001-81",
    "value": 120000.5,
    "currency": "BRL",
    "start_date": "2026-11-01",
    "end_date": "2027-10-31",
    "auto_renew": true,
    "renewal_term_months": 12,
    "notice_period_days": 30,
    "owner_id": "d6zqpbyog2v3xvxerwn8la94",
    "metadata": {
      "crm_stage": "won"
    },
    "external_references": [
      {
        "system": "hubspot",
        "id": "98765"
      }
    ]
  }
}
```

### `examples/ContractUpdatePartial`

```json
{
  "summary": "Change one term, clear another",
  "value": {
    "notice_period_days": 60,
    "counterparty_name": null
  }
}
```

### `examples/ContractUpdateReferences`

```json
{
  "summary": "Replace the external references",
  "value": {
    "external_references": [
      {
        "system": "hubspot",
        "id": "98765"
      },
      {
        "system": "erp",
        "id": "C-1042"
      }
    ]
  }
}
```

### `examples/ContractWithAmendments`

```json
{
  "summary": "The contract terms with their amendments",
  "value": {
    "status": 200,
    "message": "",
    "data": {
      "resource": "document_contract",
      "document_id": "66b2f0e1c3a4d5e6f7a8b9c0",
      "status": "active",
      "counterparty_name": "Acme Ltda",
      "counterparty_taxpayer_id": "11222333000181",
      "value": 130000,
      "currency": "BRL",
      "start_date": "2026-11-01",
      "end_date": "2028-06-30",
      "auto_renew": true,
      "renewal_term_months": 12,
      "notice_period_days": 30,
      "term": 2,
      "owner_id": "d6zqpbyog2v3xvxerwn8la94",
      "metadata": {
        "crm_stage": "won"
      },
      "external_references": [
        {
          "system": "hubspot",
          "id": "98765"
        }
      ],
      "created_at": "2026-10-23T12:00:00Z",
      "updated_at": "2027-05-12T18:20:00Z",
      "amendments": [
        {
          "document_id": "7c3d1e2f4a5b6c7d8e9f0a1b",
          "document_name": "Aditivo 1 - Contrato de prestação de serviços.pdf",
          "parent_document_id": "66b2f0e1c3a4d5e6f7a8b9c0",
          "relation_type": "amendment",
          "number": 1,
          "status": "applied",
          "document_status": "certificated",
          "apply_error": null,
          "currency": "BRL",
          "terms": {
            "value": 130000,
            "end_date": "2028-06-30"
          },
          "changes": {
            "value": {
              "from": 120000.5,
              "to": 130000
            },
            "end_date": {
              "from": "2027-10-31",
              "to": "2028-06-30"
            },
            "term": {
              "from": 1,
              "to": 2
            }
          },
          "applied_at": "2027-05-12T18:20:00Z",
          "created_at": "2027-05-10T15:00:00Z",
          "updated_at": "2027-05-12T18:20:00Z"
        }
      ]
    }
  }
}
```

### `parameters/AccountId`

```json
{
  "name": "accountId",
  "in": "path",
  "description": "Workspace account ID.",
  "required": true,
  "schema": {
    "type": "string"
  }
}
```

### `parameters/DocumentId`

```json
{
  "name": "documentId",
  "in": "path",
  "description": "Document ID.",
  "required": true,
  "schema": {
    "type": "string"
  }
}
```

### `parameters/Page`

```json
{
  "name": "page",
  "in": "query",
  "description": "Page number.",
  "schema": {
    "type": "integer",
    "minimum": 1,
    "example": 1
  }
}
```

### `parameters/PerPage`

```json
{
  "name": "per-page",
  "in": "query",
  "description": "Records per page (max 100).",
  "schema": {
    "type": "integer",
    "maximum": 100,
    "example": 25
  }
}
```

### `parameters/Search`

```json
{
  "name": "search",
  "in": "query",
  "description": "Search term.",
  "schema": {
    "type": "string"
  }
}
```

### `responses/ContractChanged`

```json
{
  "description": "The write sent the `updated_at` it read the contract (or the amendment link) with, and the contract changed since: by another user, an integration or the hourly run. Nothing was written. Read it again, check the change still applies, and send it with the new `updated_at`.",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/ErrorEnvelope"
          },
          {
            "properties": {
              "status": {
                "type": "integer",
                "example": 409
              },
              "message": {
                "type": "string",
                "example": "The contract changed after it was read; read it again and resend the change."
              },
              "code": {
                "type": "string",
                "enum": [
                  "ContractChanged"
                ],
                "example": "ContractChanged"
              }
            },
            "type": "object"
          }
        ]
      },
      "example": {
        "status": 409,
        "message": "The contract changed after it was read; read it again and resend the change.",
        "code": "ContractChanged"
      }
    }
  }
}
```

### `responses/ContractInputError`

```json
{
  "description": "The request breaks a contract rule. `errors` has one entry per problem found: the `field` as sent (`null` when the request as a whole is refused), a stable `code` to translate, and the `message` in the platform's language; `message` at the top is the first entry's. The contract's own rules on the terms, and the external references' items, report every field that breaks one, an entry per field (its first problem); the other checks (the body, its fields, the contract's state, a renewal's or a link's conditions) stop at the first problem they find.\n\n| Code | Field | Refused when |\n|------|-------|--------------|\n| `InvalidBody` | — | The body is not a JSON object (a list, a bare value), or a `PUT` of contract terms sends no attribute. |\n| `UnknownField` | the attribute | The endpoint does not take the attribute; one entry per attribute. |\n| `NotSingleValue` | the attribute | On a `PUT` of contract terms, a list sent for a term that takes one value (every term but `metadata` and `external_references`). On a link, the same list answers the term's own code. |\n| `Required` | `parent_document_id`, `relation_type`, `external_references[i].system`, `external_references[i].id` | A first link without `parent_document_id` (a pending link that was removed meanwhile) or `relation_type`; an `external_references` item without `system` or `id` (`i` is its place in the list sent, from 0). |\n| `Invalid` | the field | The value is not of the field's type or form: `status` not one of the four; `currency` not three letters; `auto_renew` not a boolean; `owner_id` not a user id; `value` not a number; `counterparty_name` holding HTML; `metadata` not an object; `external_references` not a list, an item's `system` (`external_references[i].system`) with characters other than letters, digits, `_`, `-` and `.`, or its `id` (`external_references[i].id`) with an emoji or another 4-byte character; `parent_document_id` not text; `relation_type` not `amendment`, `renewal` or `termination`; `term` not a whole number from 1; `reason` not text. On the list: a filter sent as a list, a `status` not one of the four, `ending_within_days` not a whole number. |\n| `TooSmall`, `TooBig` | the field | `value` below 0 or above 9999999999999.99; `renewal_term_months` outside 1 to 600; `notice_period_days` (and the list's `ending_within_days`) outside 0 to 3650. |\n| `TooLong` | the field | `counterparty_name` over 255 characters, counting each emoji as stored (several characters); `counterparty_taxpayer_id` over 20; `reason` over 500; `external_references[i].system` over 64 or `external_references[i].id` over 255. |\n| `TooMany` | `external_references` | More than 20 items. |\n| `TooManyDecimals` | `value` | More than two decimal places. |\n| `InvalidDate` | `start_date`, `end_date`, `updated_at`; the list's `end_date_from`, `end_date_to` | Not a date as `YYYY-MM-DD` (an impossible one such as `2026-02-30` included); `updated_at` not a date and time as the API writes it (`2026-10-23T12:00:00Z`, or with an offset). |\n| `DateTooEarly` | `start_date`, `end_date` | Before the year 1000. |\n| `DateTooLate` | `end_date` | A renewal by the term would pass 9999-12-31. |\n| `EndBeforeStart` | `end_date` | Before `start_date`. |\n| `InvalidTaxpayerId` | `counterparty_taxpayer_id` | Not a valid CPF or CNPJ (formatted or not). |\n| `NotAMember` | `owner_id` | Not an active member of the workspace. |\n| `TooManyKeys` | `metadata` | More than 50 keys. |\n| `InvalidKey` | `metadata` | A key that is not 1 to 40 letters, digits, `_`, `-` or `.`. |\n| `InvalidValue` | `metadata` | A value that is not plain text of at most 500 characters. |\n| `NumberUnderDateKey` | `metadata` | A number under a key ending in `_at`, or `stuck_since`, which the API would return as a date. |\n| `ListKeys` | `metadata` | Keys `0`, `1`, `2`…, which would read back as a list. |\n| `DuplicateReference` | `external_references` | Two items the database takes for one (accents, `ß` and `ss`); items equal case aside are merged, not refused. |\n| `StatusNotSettable` | `status` | A tracked contract sent `expired` or `terminated`, or a closed one sent `draft` or `active`: a contract is closed by terminating it and reopened by renewing it. |\n| `CannotReturnToDraft` | `status` | An `active` contract sent `draft`. |\n| `ExpiredNeedsPastEndDate` | `end_date` | New terms with status `expired` and no `end_date` before today. |\n| `TerminatedNeedsEndDate` | `end_date` | New terms with status `terminated` and no `end_date`. |\n| `UnsignableDocument` | — | New terms, or a first link, on a cancelled, declined or expired document. Terms or a link already on one stay editable. |\n| `DocumentIsAmendment` | — | Terms of its own for a document linked as an amendment: its terms are the changes it makes. |\n| `DocumentHasOwnTerms` | — | A link for a document that tracks a contract of its own: a document is a contract or an amendment, never both. |\n| `ParentHasNoTerms` | `parent_document_id` | The parent named has no contract terms, nor amends a contract that has. |\n| `ParentTerminated` | `parent_document_id` | The parent contract is terminated. |\n| `NoTermChanged` | — | An `amendment` that changes no term, also by dropping its last one. A `renewal` or `termination` may change none. |\n| `TermNotAllowed` | the term | A term the relation type cannot change: a `renewal` changes only `end_date` and `value`, a `termination` only `end_date`. |\n| `AmendmentApplied` | — | The amendment applied when its document was signed and can no longer change. |\n| `TermOrEndDateRequired` | — | A renewal sends neither `term` nor `end_date`. |\n| `TermMismatch` | `term` | Not the contract's current term: the renewal already happened. |\n| `ContractTerminated` | — | A renewal of a terminated contract. |\n| `EndDateRequired` | `end_date` | A renewal by the term, or a `renewal` link without `end_date`, of a contract without an end date. |\n| `EndDateNotAfterCurrent` | `end_date` | A renewal, or a `renewal` link, to a date not after the current end date. |\n| `AlreadyTerminated` | — | A termination of a contract already terminated. |\n\nA body that is not valid JSON is refused before it reaches these endpoints, with the platform's `400` and no `errors`. A link is also checked against what applying it today would give the parent, so a delta the contract would refuse comes back with the contract's own codes.",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/ErrorEnvelope"
          },
          {
            "properties": {
              "status": {
                "type": "integer",
                "example": 400
              },
              "message": {
                "description": "The first entry's message.",
                "type": "string",
                "example": "value must be no less than 0."
              },
              "errors": {
                "type": "array",
                "items": {
                  "required": [
                    "field",
                    "code",
                    "message"
                  ],
                  "properties": {
                    "field": {
                      "description": "The attribute or filter as sent; `null` when the request as a whole is refused.",
                      "type": [
                        "string",
                        "null"
                      ],
                      "example": "value"
                    },
                    "code": {
                      "description": "Stable, in English, one of the codes above.",
                      "type": "string",
                      "example": "TooSmall"
                    },
                    "message": {
                      "description": "In the platform's language.",
                      "type": "string",
                      "example": "value must be no less than 0."
                    }
                  },
                  "type": "object"
                }
              }
            },
            "type": "object"
          }
        ]
      },
      "example": {
        "status": 400,
        "message": "value must be no less than 0.",
        "errors": [
          {
            "field": "value",
            "code": "TooSmall",
            "message": "value must be no less than 0."
          },
          {
            "field": "currency",
            "code": "Invalid",
            "message": "currency is invalid."
          }
        ]
      }
    }
  }
}
```

### `responses/Forbidden`

```json
{
  "description": "Authenticated but not allowed to perform this action.",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/ErrorEnvelope"
          },
          {
            "properties": {
              "status": {
                "type": "integer",
                "example": 403
              },
              "message": {
                "type": "string",
                "example": "You are not allowed to perform this action."
              }
            },
            "type": "object"
          }
        ]
      }
    }
  }
}
```

### `responses/NoContractTerms`

```json
{
  "description": "The document is not in the workspace (`Document not found.`), or carries no contract terms (on a read: neither its own nor those of a contract it amends whose document still exists). Only the second has a `code`, `NoContractTerms`, so a document without terms can be told from one that is not there.",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/ErrorEnvelope"
          },
          {
            "properties": {
              "status": {
                "type": "integer",
                "example": 404
              },
              "message": {
                "type": "string",
                "example": "This document has no contract terms."
              },
              "code": {
                "description": "Present only when the document is in the workspace but carries no contract terms.",
                "type": "string",
                "enum": [
                  "NoContractTerms"
                ],
                "example": "NoContractTerms"
              }
            },
            "type": "object"
          }
        ]
      },
      "example": {
        "status": 404,
        "message": "This document has no contract terms.",
        "code": "NoContractTerms"
      }
    }
  }
}
```

### `responses/NotFound`

```json
{
  "description": "The requested resource does not exist.",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/ErrorEnvelope"
          },
          {
            "properties": {
              "status": {
                "type": "integer",
                "example": 404
              },
              "message": {
                "type": "string",
                "example": "The requested resource was not found."
              }
            },
            "type": "object"
          }
        ]
      }
    }
  }
}
```

### `responses/ServerError`

```json
{
  "description": "Unexpected server error.",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/ErrorEnvelope"
          },
          {
            "properties": {
              "status": {
                "type": "integer",
                "example": 500
              },
              "message": {
                "type": "string",
                "example": "An unexpected error occurred."
              }
            },
            "type": "object"
          }
        ]
      }
    }
  }
}
```

### `responses/Unauthorized`

```json
{
  "description": "Missing or invalid credentials.",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/ErrorEnvelope"
          },
          {
            "properties": {
              "status": {
                "type": "integer",
                "example": 401
              },
              "message": {
                "type": "string",
                "example": "Your request was made with invalid credentials."
              }
            },
            "type": "object"
          }
        ]
      }
    }
  }
}
```

### `responses/ValidationError`

```json
{
  "description": "One or more fields failed validation.",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "allOf": [
          {
            "$ref": "#/components/schemas/ErrorEnvelope"
          },
          {
            "properties": {
              "status": {
                "type": "integer",
                "example": 422
              },
              "message": {
                "type": "string",
                "example": "One or more fields failed validation."
              }
            },
            "type": "object"
          }
        ]
      }
    }
  }
}
```

### `schemas/Account`

```json
{
  "description": "A workspace account (organization).",
  "properties": {
    "resource": {
      "type": "string",
      "example": "account"
    },
    "id": {
      "type": "string",
      "example": "6401df46d6a6b0c692d9ec49"
    },
    "name": {
      "type": "string",
      "example": "Acme Inc."
    },
    "primary_color": {
      "type": [
        "string",
        "null"
      ],
      "example": "aabbcc"
    },
    "secondary_color": {
      "type": [
        "string",
        "null"
      ],
      "example": "112233"
    },
    "notification_sender_type": {
      "type": "string",
      "enum": [
        "User",
        "Account"
      ],
      "example": "User"
    },
    "roles": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "example": [
        "owner"
      ]
    },
    "is_delete_allowed": {
      "type": "boolean",
      "example": true
    },
    "limits": {
      "description": "Limits of the workspace's current plan. Returned only by `GET /v1/accounts/{accountId}`, not in account lists. More keys may be added.",
      "properties": {
        "webhook_endpoints": {
          "description": "How many webhook endpoints the workspace can have: `1`, or `3` with the Multiple Webhooks feature. Creating one past the limit returns `403`.",
          "type": "integer",
          "example": 1
        }
      },
      "type": "object"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-06-03T03:54:16Z"
    }
  },
  "type": "object"
}
```

### `schemas/Assignment`

```json
{
  "description": "A request for signers to sign a document.",
  "properties": {
    "resource": {
      "type": "string",
      "example": "assignment"
    },
    "id": {
      "type": "string",
      "example": "615606ef81d199996981dbce"
    },
    "document_id": {
      "description": "The document this assignment belongs to. `null` only if the document was deleted.",
      "type": [
        "string",
        "null"
      ],
      "example": "615601fab04c0a3147bb1246"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-06-03T03:54:16Z"
    },
    "sender_email": {
      "description": "Email of the user who sent the document; null once that user has deleted their account.",
      "type": [
        "string",
        "null"
      ],
      "format": "email",
      "example": "signer@example.invalid"
    },
    "method": {
      "type": "string",
      "enum": [
        "virtual",
        "collect"
      ],
      "example": "virtual"
    },
    "expires_at": {
      "type": [
        "string",
        "null"
      ],
      "format": "date-time",
      "example": null
    },
    "message": {
      "type": [
        "string",
        "null"
      ]
    },
    "signers": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/AssignmentSigner"
      }
    },
    "copy_receivers": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "items": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/AssignmentItem"
      }
    },
    "summary": {
      "$ref": "#/components/schemas/AssignmentSummary"
    },
    "signing_urls": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/SigningUrl"
      }
    }
  },
  "type": "object"
}
```

### `schemas/AssignmentItem`

```json
{
  "properties": {
    "id": {
      "type": "string"
    },
    "page": {
      "oneOf": [
        {
          "$ref": "#/components/schemas/DocumentPage"
        },
        {
          "type": "null"
        }
      ]
    },
    "signer": {
      "description": "Signer responsible for this item.",
      "type": "object"
    },
    "field": {
      "description": "Field definition associated with the item.",
      "type": [
        "object",
        "null"
      ]
    },
    "display_settings": {
      "description": "Rendering metadata for the item. Collect items use the DisplaySettings schema; virtual and legacy items may return an empty or non-object value."
    },
    "value": {
      "description": "Captured value when completed; `null` until then."
    },
    "completed": {
      "type": "boolean"
    }
  },
  "type": "object"
}
```

### `schemas/AssignmentSigner`

```json
{
  "description": "A signer within an assignment: the base Signer plus per-assignment verification/notification details.",
  "type": "object",
  "allOf": [
    {
      "$ref": "#/components/schemas/Signer"
    },
    {
      "properties": {
        "verification_method": {
          "type": [
            "string",
            "null"
          ],
          "example": "Email"
        },
        "notification_methods": {
          "type": [
            "array",
            "null"
          ],
          "items": {
            "type": "string"
          },
          "example": [
            "Email"
          ]
        },
        "step": {
          "description": "Sequential signing step (defaults to 1).",
          "type": [
            "integer",
            "null"
          ],
          "example": 1
        },
        "notified": {
          "type": [
            "boolean",
            "null"
          ]
        },
        "identity_verification_status": {
          "description": "Latest identity-document verification status; `InReview` means the account must decide it before the document can be certificated.",
          "type": [
            "string",
            "null"
          ],
          "enum": [
            "Pending",
            "InReview",
            "Approved",
            "Declined",
            "Expired",
            "Abandoned"
          ],
          "example": "InReview"
        },
        "completed": {
          "description": "Only present in account-owner contexts.",
          "type": [
            "boolean",
            "null"
          ]
        },
        "notification_history": {
          "description": "Per-channel delivery history for this signer (email + WhatsApp), most-recent send order.",
          "type": [
            "array",
            "null"
          ],
          "items": {
            "$ref": "#/components/schemas/NotificationHistoryEntry"
          }
        }
      },
      "type": "object"
    }
  ]
}
```

### `schemas/AssignmentSummary`

```json
{
  "properties": {
    "signer_count": {
      "type": "integer"
    },
    "completed_count": {
      "type": "integer"
    },
    "signers": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  },
  "type": "object"
}
```

### `schemas/CostEstimate`

```json
{
  "description": "Cost breakdown for an assignment plus current account balances. `credits` is the sum of `breakdown` (notifications, digital-certificate signatures and identity checks). `total_credits` is what the send will take from the credit balance: `credits`, plus `extra_document_cost` when `needs_extra_document` is true. The extra document is not a `breakdown` line.",
  "properties": {
    "documents": {
      "description": "Documents consumed (always 1).",
      "type": "integer",
      "example": 1
    },
    "credits": {
      "description": "Sum of the `breakdown` costs: notifications, digital-certificate signatures and identity checks. Does not include the extra document.",
      "type": "number",
      "example": 0.9
    },
    "needs_extra_document": {
      "description": "True when the plan's document allowance is exhausted and an extra document will be charged from credits.",
      "type": "boolean",
      "example": true
    },
    "extra_document_cost": {
      "description": "Credits for one extra document. Charged only when `needs_extra_document` is true.",
      "type": "number",
      "example": 1
    },
    "total_credits": {
      "description": "Credits the send will consume: `credits`, plus `extra_document_cost` when `needs_extra_document` is true.",
      "type": "number",
      "example": 1.9
    },
    "breakdown": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/CostEstimateBreakdownItem"
      }
    },
    "document_balance": {
      "description": "Documents left in the plan.",
      "type": "number",
      "example": 0
    },
    "credit_balance": {
      "description": "Credits available.",
      "type": "number",
      "example": 10
    },
    "has_sufficient_resources": {
      "type": "boolean",
      "example": true
    },
    "blocking_reason": {
      "type": [
        "string",
        "null"
      ],
      "enum": [
        "PendingPayment",
        "InsufficientDocuments",
        "InsufficientCredits"
      ],
      "example": null
    },
    "message": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "type": "object"
}
```

### `schemas/CostEstimateBreakdownItem`

```json
{
  "properties": {
    "code": {
      "type": "string",
      "example": "NotificationWhatsapp"
    },
    "name": {
      "type": "string",
      "example": "Whatsapp Notification"
    },
    "cost": {
      "type": "number",
      "example": 0.9
    },
    "quantity": {
      "type": "integer",
      "example": 2
    },
    "unit_cost": {
      "type": "number",
      "example": 0.45
    }
  },
  "type": "object"
}
```

### `schemas/DisplaySettings`

```json
{
  "description": "A field placement rectangle on a document page. Geometry values are pixels in Assinafy's 150-DPI page image, measured from the upper-left corner. Clients must keep the rectangle within the selected page's width and height; the API does not clamp out-of-bounds values.",
  "required": [
    "left",
    "top",
    "width",
    "height",
    "fontSize"
  ],
  "properties": {
    "left": {
      "description": "Horizontal distance from the page's left edge, in page-image pixels.",
      "type": "number",
      "format": "float",
      "minimum": 0,
      "example": 69
    },
    "top": {
      "description": "Vertical distance from the page's top edge, in page-image pixels.",
      "type": "number",
      "format": "float",
      "minimum": 0,
      "example": 282
    },
    "width": {
      "description": "Width of the placement rectangle, in page-image pixels.",
      "type": "number",
      "format": "float",
      "exclusiveMinimum": 0,
      "example": 421
    },
    "height": {
      "description": "Height of the placement rectangle, in page-image pixels.",
      "type": "number",
      "format": "float",
      "exclusiveMinimum": 0,
      "example": 45.86
    },
    "fontFamily": {
      "description": "Font-family presentation metadata.",
      "type": "string",
      "example": "Arial"
    },
    "fontSize": {
      "description": "Font size in the 150-DPI page-image coordinate system.",
      "type": "number",
      "format": "float",
      "exclusiveMinimum": 0,
      "example": 22
    },
    "backgroundColor": {
      "description": "CSS-compatible background-color presentation metadata.",
      "type": "string",
      "example": "#D5EBFF"
    }
  },
  "type": "object"
}
```

### `schemas/Document`

```json
{
  "description": "A document and its current lifecycle state.",
  "properties": {
    "resource": {
      "description": "Present in single-resource responses.",
      "type": "string",
      "example": "document"
    },
    "id": {
      "type": "string",
      "example": "615601fab04c0a3147bb1246"
    },
    "account_id": {
      "type": "string",
      "example": "d199996981dbd199996981db"
    },
    "template_id": {
      "type": [
        "string",
        "null"
      ],
      "example": null
    },
    "name": {
      "type": "string",
      "example": "document.pdf"
    },
    "status": {
      "description": "Status code — see GET /v1/documents/statuses.",
      "type": "string",
      "example": "metadata_ready"
    },
    "artifacts": {
      "description": "Artifact download URLs keyed by name. Always `original`, plus `thumbnail` once one exists. A certificated document also carries `certificated`, `certificate-page` and `bundle`, and `pades` when it was signed with a digital certificate — the PAdES version holds the signers' ICP-Brasil signatures, which certification flattens out of the certificated PDF.",
      "type": "object",
      "example": {
        "original": "https://api.assinafy.com.br/v1/documents/doc1/download/original"
      }
    },
    "is_closed": {
      "type": "boolean",
      "example": false
    },
    "signing_url": {
      "type": "string",
      "example": "https://api.assinafy.com.br/v1/sign/doc1"
    },
    "verification_code": {
      "description": "The code printed on the certificate page. Anyone can check it with `GET /v1/documents/{verification_code}/verify` or on `verification_url`. `null` until the document is `certificated`, and on documents certificated before verification codes existed.",
      "type": [
        "string",
        "null"
      ],
      "example": "a3f1c9e07b2d4e8f9a6c5b1d0e7f3a2c9b8d4e6f"
    },
    "verification_url": {
      "description": "The public verification page for this document. `null` until the document is `certificated`.",
      "type": [
        "string",
        "null"
      ],
      "format": "uri",
      "example": "https://www.assinafy.com.br/verificador/a3f1c9e07b2d4e8f9a6c5b1d0e7f3a2c9b8d4e6f"
    },
    "decline_reason": {
      "type": [
        "string",
        "null"
      ],
      "example": null
    },
    "declined_by": {
      "oneOf": [
        {
          "$ref": "#/components/schemas/Signer"
        },
        {
          "type": "null"
        }
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "type": "object"
      }
    },
    "assignment": {
      "description": "The document's assignment, or `null` before one is created. The server decides when it is included, whatever `expand` the request sends: the document list, `GET /v1/documents/{documentId}`, the signer's document list and document creation from a template always include it; `/documents/search` and the upload response never do. Only the rename response follows `?expand=assignment`.",
      "oneOf": [
        {
          "$ref": "#/components/schemas/Assignment"
        },
        {
          "type": "null"
        }
      ]
    },
    "pages": {
      "description": "The document's pages. Included on the same responses as `assignment`, and also on the upload response.",
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/DocumentPage"
      }
    },
    "has_contract": {
      "description": "Only on `GET /v1/documents/{documentId}` read by the workspace, while the environment has contract tracking on: not with a signer's access code, not in document lists or webhooks, and left out when the lookup fails, so a missing key means unknown. Whether `GET /v1/accounts/{accountId}/documents/{documentId}/contract` answers with contract terms, the document's own or those of a contract it amends whose document still exists, so a page can lay out the contract section before reading it.",
      "type": "boolean",
      "example": true
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-06-03T03:54:16Z"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-06-03T03:54:16Z"
    }
  },
  "type": "object"
}
```

### `schemas/DocumentContract`

```json
{
  "description": "The contract terms tracked on a document.",
  "properties": {
    "resource": {
      "type": "string",
      "example": "document_contract"
    },
    "document_id": {
      "type": "string",
      "example": "66b2f0e1c3a4d5e6f7a8b9c0"
    },
    "status": {
      "type": "string",
      "enum": [
        "draft",
        "active",
        "expired",
        "terminated"
      ],
      "example": "active"
    },
    "counterparty_name": {
      "type": [
        "string",
        "null"
      ],
      "example": "Acme Ltda"
    },
    "counterparty_taxpayer_id": {
      "description": "CPF or CNPJ, digits only.",
      "type": [
        "string",
        "null"
      ],
      "example": "11222333000181"
    },
    "value": {
      "description": "Two decimal places at most.",
      "type": [
        "number",
        "null"
      ],
      "example": 120000.5
    },
    "currency": {
      "description": "ISO 4217 code; `BRL` when a value is sent without one.",
      "type": [
        "string",
        "null"
      ],
      "example": "BRL"
    },
    "start_date": {
      "type": [
        "string",
        "null"
      ],
      "format": "date",
      "example": "2026-11-01"
    },
    "end_date": {
      "type": [
        "string",
        "null"
      ],
      "format": "date",
      "example": "2027-10-31"
    },
    "auto_renew": {
      "type": "boolean",
      "example": true
    },
    "renewal_term_months": {
      "type": [
        "integer",
        "null"
      ],
      "example": 12
    },
    "notice_period_days": {
      "type": [
        "integer",
        "null"
      ],
      "example": 30
    },
    "term": {
      "description": "Steps on every renewal, starting at 1.",
      "type": "integer",
      "example": 1
    },
    "owner_id": {
      "description": "ID of the workspace member who owns the contract. When the owner is no longer a member of the workspace (removed, left, or deleted with their account), the hourly run hands the contract to the first owner who is still an active member, or leaves it without one; an inactive member stays the owner. The contract's e-mails (renewal notice, expiring, expired, renewed) go to the first of the owner and the document's creator who is an active member, as that member's notification preferences allow.",
      "type": [
        "string",
        "null"
      ],
      "example": "d6zqpbyog2v3xvxerwn8la94"
    },
    "metadata": {
      "description": "Up to 50 keys of your own, each holding text of at most 500 characters; `null` when there are none. A key ending in `_at` cannot hold a number: the API returns numbers under such keys as dates.",
      "type": [
        "object",
        "null"
      ],
      "example": {
        "crm_stage": "won"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "external_references": {
      "description": "IDs outside systems use for this contract, ordered by system and id.",
      "type": "array",
      "items": {
        "properties": {
          "system": {
            "type": "string",
            "example": "hubspot"
          },
          "id": {
            "type": "string",
            "example": "98765"
          }
        },
        "type": "object"
      }
    },
    "document": {
      "$ref": "#/components/schemas/Document",
      "description": "Only with `expand=document`: the document the terms are tracked on."
    },
    "amendments": {
      "description": "Only on the single-contract read: the documents that amend, renew or terminate this contract, the applied ones first by `number`, then the pending ones.",
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/DocumentContractAmendment"
      }
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-10-23T12:00:00Z"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-10-23T12:00:00Z"
    }
  },
  "type": "object"
}
```

### `schemas/DocumentContractAmendment`

```json
{
  "description": "A document that amends, renews or terminates a contract: its link and the terms it changes. The parent's terms take the delta once this document is certificated; until then the parent is untouched.",
  "properties": {
    "resource": {
      "type": "string",
      "example": "document_contract_amendment"
    },
    "document_id": {
      "description": "This document, the instrument.",
      "type": "string",
      "example": "7c3d1e2f4a5b6c7d8e9f0a1b"
    },
    "document_name": {
      "description": "This document's name.",
      "type": "string",
      "example": "Aditivo 1 - Contrato de prestação de serviços.pdf"
    },
    "parent_document_id": {
      "description": "The contract document whose terms change.",
      "type": "string",
      "example": "66b2f0e1c3a4d5e6f7a8b9c0"
    },
    "relation_type": {
      "type": "string",
      "enum": [
        "amendment",
        "renewal",
        "termination"
      ],
      "example": "amendment"
    },
    "number": {
      "description": "Position among the parent's applied amendments by signing date; `null` while pending.",
      "type": [
        "integer",
        "null"
      ],
      "example": 1
    },
    "status": {
      "description": "`applied` once the delta moved the parent's terms.",
      "type": "string",
      "enum": [
        "pending",
        "applied"
      ],
      "example": "pending"
    },
    "document_status": {
      "description": "This document's own status, so a declined, cancelled or expired instrument shows as such. An instrument applies only while its document is `certificated`: one whose document reads `failed` after it was signed waits, with no `apply_error`, until it is certificated again, and then applies in its place in the signing order.",
      "type": "string",
      "example": "pending_signature"
    },
    "apply_error": {
      "description": "Why a signed instrument has not applied yet, retried every hour: the workspace's plan does not include contract tracking (it applies on the first run after the plan returns), the parent would not take the delta, an instrument signed before this one has not applied yet, one signed after it has already applied (this one then stays blocked: unlink it, and record what it still changes on a new instrument), or an unexpected failure.",
      "type": [
        "string",
        "null"
      ]
    },
    "currency": {
      "description": "The currency of the amounts in `terms` and `changes`. Once applied, the contract's currency at that moment, kept whatever the contract moves to later. While pending (and for an instrument applied before this was kept), the one this instrument moves the contract to, otherwise the contract's. `null` when neither has one.",
      "type": [
        "string",
        "null"
      ],
      "example": "BRL"
    },
    "terms": {
      "description": "The delta: only the terms this instrument changes; `null` when it changes none (a termination on the day it is signed).",
      "type": [
        "object",
        "null"
      ],
      "example": {
        "value": 130000,
        "end_date": "2028-06-30"
      }
    },
    "changes": {
      "description": "Every parent field the roll-up moves, as `{from, to}`: a preview while pending, the record once applied; `null` when it moves none.",
      "type": [
        "object",
        "null"
      ],
      "example": {
        "value": {
          "from": 120000.5,
          "to": 130000
        },
        "end_date": {
          "from": "2027-10-31",
          "to": "2028-06-30"
        },
        "term": {
          "from": 1,
          "to": 2
        }
      }
    },
    "applied_at": {
      "type": [
        "string",
        "null"
      ],
      "format": "date-time"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-10-23T12:00:00Z"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-10-23T12:00:00Z"
    }
  },
  "type": "object"
}
```

### `schemas/DocumentContractInput`

```json
{
  "description": "Every attribute is optional and only the ones sent change. `null` clears an attribute, except `auto_renew` (back to `false`) and `currency` (back to `BRL` while a `value` is set); `status` does not accept `null`. A changed `end_date` starts a new `term`.",
  "properties": {
    "status": {
      "description": "On creation any status, so a contract that ended before it was tracked is registered as it ended: `expired` needs an `end_date` in the past, `terminated` its `end_date`; neither is walked by the lifecycle. Afterwards only `draft` or `active` (a contract in force never goes back to `draft`): `expired` and `terminated` are set by the lifecycle and the terminate endpoint; a closed contract is reopened by renewing it.",
      "type": "string",
      "enum": [
        "draft",
        "active",
        "expired",
        "terminated"
      ]
    },
    "counterparty_name": {
      "description": "Emoji are kept; other characters outside the 3-byte range are dropped.",
      "type": [
        "string",
        "null"
      ],
      "maxLength": 255
    },
    "counterparty_taxpayer_id": {
      "description": "A valid CPF or CNPJ, formatted or not.",
      "type": [
        "string",
        "null"
      ]
    },
    "value": {
      "description": "Two decimal places at most.",
      "type": [
        "number",
        "null"
      ],
      "maximum": 9999999999999.99,
      "minimum": 0
    },
    "currency": {
      "description": "Three letters, such as `BRL` or `USD`, stored in capitals; `BRL` when a `value` is set without one.",
      "type": [
        "string",
        "null"
      ],
      "example": "BRL"
    },
    "start_date": {
      "description": "`YYYY-MM-DD`, from the year 1000.",
      "type": [
        "string",
        "null"
      ],
      "format": "date"
    },
    "end_date": {
      "description": "`YYYY-MM-DD`, on or after `start_date`.",
      "type": [
        "string",
        "null"
      ],
      "format": "date"
    },
    "auto_renew": {
      "description": "Whether the hourly run starts the next term the day after `end_date`, by `renewal_term_months`, instead of expiring the contract.",
      "type": "boolean"
    },
    "renewal_term_months": {
      "description": "How far a renewal by the term moves `end_date`; 12 when unset.",
      "type": [
        "integer",
        "null"
      ],
      "maximum": 600,
      "minimum": 1
    },
    "notice_period_days": {
      "description": "Days before `end_date` the notice period starts (`document_contract_renewal_notice`); none when unset.",
      "type": [
        "integer",
        "null"
      ],
      "maximum": 3650,
      "minimum": 0
    },
    "owner_id": {
      "description": "An active member of this workspace.",
      "type": [
        "string",
        "null"
      ]
    },
    "metadata": {
      "description": "Your own fields: up to 50 keys of 1 to 40 letters, digits, `_`, `-` or `.`, each holding plain text of at most 500 characters; no number under a key ending in `_at`, or `stuck_since`.",
      "maxProperties": 50,
      "type": [
        "object",
        "null"
      ],
      "additionalProperties": {
        "type": "string",
        "maxLength": 500
      }
    },
    "external_references": {
      "description": "Replaces the whole list; `[]` or `null` clears it. Two items whose `system` and `id` compare equal case aside are one reference (the first sent is kept); a pair the database takes for one beyond that (accents, `ß` and `ss`) answers `400`.",
      "type": [
        "array",
        "null"
      ],
      "items": {
        "required": [
          "system",
          "id"
        ],
        "properties": {
          "system": {
            "description": "Letters, digits, `_`, `-` and `.`; stored in lower case.",
            "type": "string",
            "maxLength": 64,
            "example": "hubspot"
          },
          "id": {
            "description": "Kept as sent; must not contain emoji or other 4-byte characters.",
            "type": "string",
            "maxLength": 255,
            "example": "98765"
          }
        },
        "type": "object"
      },
      "maxItems": 20
    },
    "parent_document_id": {
      "description": "Links the document as an amendment of this contract document, or of any document in its family (resolved to the root); `null` unlinks a pending amendment. With it, the other attributes are the terms the instrument changes, not terms of its own; on a pending amendment a `null` value drops that term from the delta rather than clearing it on the parent.",
      "type": [
        "string",
        "null"
      ]
    },
    "relation_type": {
      "description": "Required on the first link. `amendment` may change `value`, `currency`, `start_date` (effective from, display only), `end_date`, `auto_renew`, `renewal_term_months`, `notice_period_days`, `counterparty_name`, `counterparty_taxpayer_id` and `metadata`; `renewal` only `end_date` and `value`; `termination` only `end_date` (the effective date).",
      "type": "string",
      "enum": [
        "amendment",
        "renewal",
        "termination"
      ]
    },
    "updated_at": {
      "description": "Optional precondition: the `updated_at` the client read the contract (or this document's amendment link) with, as the API returned it. If the contract or link changed since, nothing is written and the answer is `409` with `code: ContractChanged`. Not sent, or `null`: the write applies whatever changed meanwhile (last write wins). Compared to the second; a fraction of a second, as a JavaScript date prints it, is read and ignored. New terms and a first link have nothing to have read, so sending one answers `409`; on a pending amendment, send the link's own `updated_at` (the GET on that document).",
      "type": "string",
      "format": "date-time",
      "example": "2026-10-23T12:00:00Z"
    }
  },
  "type": "object"
}
```

### `schemas/DocumentPage`

```json
{
  "properties": {
    "id": {
      "type": "string",
      "example": "615601faf166d6d1d8e7dc30"
    },
    "number": {
      "type": "integer",
      "example": 1
    },
    "height": {
      "type": "integer",
      "example": 2100
    },
    "width": {
      "type": "integer",
      "example": 1275
    },
    "download_url": {
      "type": "string",
      "example": "https://api.assinafy.com.br/v1/documents/doc1/pages/1a/download"
    }
  },
  "type": "object"
}
```

### `schemas/Envelope`

```json
{
  "description": "Standard success wrapper. Operations add their own `data`.",
  "properties": {
    "status": {
      "description": "HTTP status code, mirrored in the body.",
      "type": "integer",
      "example": 200
    },
    "message": {
      "description": "Human-readable message; empty on success.",
      "type": "string",
      "example": ""
    }
  },
  "type": "object"
}
```

### `schemas/ErrorEnvelope`

```json
{
  "description": "Standard error wrapper. `status` mirrors the HTTP status code.",
  "properties": {
    "status": {
      "type": "integer",
      "example": 400
    },
    "message": {
      "description": "Human-readable error message.",
      "type": "string",
      "example": "Bad request."
    },
    "data": {
      "type": [
        "object",
        "null"
      ],
      "example": null
    }
  },
  "type": "object"
}
```

### `schemas/NotificationHistoryEntry`

```json
{
  "description": "A single notification delivery record for a signer channel.",
  "properties": {
    "event": {
      "type": "string",
      "example": "signature_request"
    },
    "status": {
      "type": "string",
      "enum": [
        "sent",
        "failed"
      ],
      "example": "sent"
    },
    "error_code": {
      "type": [
        "string",
        "null"
      ]
    },
    "error_message": {
      "type": [
        "string",
        "null"
      ]
    },
    "sent_at": {
      "type": [
        "string",
        "null"
      ],
      "format": "date-time",
      "example": "2026-07-07T12:00:00Z"
    },
    "failed_at": {
      "type": [
        "string",
        "null"
      ],
      "format": "date-time",
      "example": null
    }
  },
  "type": "object"
}
```

### `schemas/OAuthRevokeRequest`

```json
{
  "description": "Body of `POST /v1/oauth/revoke`. Sent form-encoded per RFC 7009, or as JSON.",
  "required": [
    "token",
    "client_id"
  ],
  "properties": {
    "token": {
      "type": "string"
    },
    "token_type_hint": {
      "type": "string",
      "enum": [
        "access_token",
        "refresh_token"
      ]
    },
    "client_id": {
      "type": "string"
    },
    "client_secret": {
      "type": "string"
    }
  },
  "type": "object"
}
```

### `schemas/OAuthTokenRequest`

```json
{
  "description": "Body of `POST /v1/oauth/token`. Sent form-encoded per RFC 6749, or as JSON.",
  "required": [
    "grant_type",
    "client_id"
  ],
  "properties": {
    "grant_type": {
      "description": "`urn:ietf:params:oauth:grant-type:token-exchange` is for internal service clients only (Assinafy's own MCP server) — an ordinary confidential or public client authenticates with it and always gets `invalid_client`, exactly as an unrecognized client would. Everyday integrators use `authorization_code` and `refresh_token`.",
      "type": "string",
      "enum": [
        "authorization_code",
        "refresh_token",
        "urn:ietf:params:oauth:grant-type:token-exchange"
      ]
    },
    "code": {
      "type": "string"
    },
    "redirect_uri": {
      "type": "string",
      "format": "uri"
    },
    "code_verifier": {
      "description": "RFC 7636: 43-128 characters from [A-Za-z0-9-._~]. Shorter values are rejected with `invalid_grant`.",
      "type": "string"
    },
    "refresh_token": {
      "type": "string"
    },
    "client_id": {
      "type": "string"
    },
    "client_secret": {
      "description": "Confidential clients only. Public clients authenticate with PKCE and are never issued a secret; the token-exchange grant requires a confidential, internal-service client and therefore always requires this.",
      "type": "string"
    },
    "resource": {
      "description": "RFC 8707 resource indicator. For `authorization_code`/`refresh_token`, optional; when present it must be the `resource` value published by /.well-known/oauth-protected-resource and must match the one sent to /authorize, otherwise `invalid_target`. For the token-exchange grant it is REQUIRED and must equal this API's own resource identifier exactly (never a front-end resource such as the MCP server), otherwise `invalid_target`.",
      "type": "string",
      "format": "uri"
    },
    "subject_token": {
      "description": "Token-exchange grant only. The front-end resource's access token being traded in. Must be a live, original (never itself exchanged) token minted for a resource this server issues tokens for, other than this API's own audience.",
      "type": "string"
    },
    "subject_token_type": {
      "description": "Token-exchange grant only. Required; only `urn:ietf:params:oauth:token-type:access_token` is supported.",
      "type": "string",
      "enum": [
        "urn:ietf:params:oauth:token-type:access_token"
      ]
    },
    "requested_token_type": {
      "description": "Token-exchange grant only. Optional; when present it must agree with the only type this server issues.",
      "type": "string",
      "enum": [
        "urn:ietf:params:oauth:token-type:access_token"
      ]
    }
  },
  "type": "object"
}
```

### `schemas/ResendCostEstimate`

```json
{
  "description": "Credits a reminder to one signer will take, and whether the account can pay for it. A reminder uses no document.",
  "properties": {
    "total": {
      "description": "Sum of the `breakdown` costs.",
      "type": "number",
      "example": 0.45
    },
    "breakdown": {
      "type": "array",
      "items": {
        "properties": {
          "code": {
            "type": "string",
            "example": "NotificationWhatsappResend"
          },
          "name": {
            "type": "string",
            "example": "Whatsapp Notification Resend"
          },
          "cost": {
            "type": "number",
            "example": 0.45
          }
        },
        "type": "object"
      }
    },
    "credit_balance": {
      "description": "Credits available. `null` when the account's credits are not limited.",
      "type": [
        "number",
        "null"
      ],
      "example": 10
    },
    "has_sufficient_credits": {
      "type": "boolean",
      "example": true
    }
  },
  "type": "object"
}
```

### `schemas/Signer`

```json
{
  "description": "A signing party belonging to a workspace account.",
  "properties": {
    "resource": {
      "description": "Present in single-resource responses.",
      "type": "string",
      "example": "signer"
    },
    "id": {
      "type": "string",
      "example": "62d6ee35c7741ca4006b9e11"
    },
    "full_name": {
      "type": "string",
      "example": "John Signer"
    },
    "email": {
      "type": [
        "string",
        "null"
      ],
      "format": "email",
      "example": "signer@example.invalid"
    },
    "whatsapp_phone_number": {
      "description": "E.164 format; normalized on save.",
      "type": [
        "string",
        "null"
      ],
      "example": "+5548999990000"
    },
    "government_id": {
      "description": "Signer's normalized CPF (11 digits) or CNPJ (14 characters; may be alphanumeric).",
      "type": [
        "string",
        "null"
      ],
      "example": "39053344705"
    },
    "has_accepted_terms": {
      "type": "boolean",
      "example": false
    }
  },
  "type": "object"
}
```

### `schemas/SigningUrl`

```json
{
  "properties": {
    "signer_id": {
      "type": "string"
    },
    "url": {
      "type": "string",
      "example": "https:signer@example.invalid"
    }
  },
  "type": "object"
}
```

### `schemas/Template`

```json
{
  "description": "A reusable document template.",
  "properties": {
    "resource": {
      "type": "string",
      "example": "template"
    },
    "id": {
      "type": "string",
      "example": "fa88b732db84d01427d4cdd1092"
    },
    "name": {
      "type": "string",
      "example": "template.pdf"
    },
    "document_name": {
      "description": "Default name for documents created from this template.",
      "type": [
        "string",
        "null"
      ]
    },
    "message": {
      "description": "Default invitation message.",
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "description": "One of uploading, uploaded, processing, ready, failed.",
      "type": "string",
      "example": "ready"
    },
    "pages": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/TemplatePage"
      }
    },
    "roles": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/TemplateRole"
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "type": "object"
      }
    },
    "default_document_tags": {
      "description": "Applied to documents created from this template; only returned by the single-template endpoint.",
      "type": "array",
      "items": {
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "type": "object"
      }
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "type": "object"
}
```

### `schemas/TemplateFieldPlacement`

```json
{
  "properties": {
    "id": {
      "type": "string"
    },
    "field_id": {
      "type": "string"
    },
    "role_id": {
      "type": "string"
    },
    "label": {
      "type": "string"
    },
    "display_settings": {
      "description": "Rendering metadata for the placement."
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "type": "object"
}
```

### `schemas/TemplatePage`

```json
{
  "properties": {
    "id": {
      "type": "string"
    },
    "number": {
      "type": "integer",
      "example": 1
    },
    "height": {
      "type": "integer",
      "example": 2100
    },
    "width": {
      "type": "integer",
      "example": 1275
    },
    "download_url": {
      "type": "string"
    },
    "fields": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/TemplateFieldPlacement"
      }
    }
  },
  "type": "object"
}
```

### `schemas/TemplateRole`

```json
{
  "properties": {
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string",
      "example": "Editor"
    },
    "assignment_type": {
      "type": "string",
      "example": "Editor"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "type": "object"
}
```

### `schemas/WebhookEndpoint`

```json
{
  "description": "A URL that receives the account's webhook events. Every active endpoint subscribed to an event receives it.",
  "properties": {
    "resource": {
      "description": "Always `activity_event_subscription` in single-resource responses.",
      "type": "string",
      "example": "activity_event_subscription"
    },
    "id": {
      "description": "Endpoint ID.",
      "type": "string",
      "example": "65f1c2a9b3e4d5f60718293a4b5c6d7e"
    },
    "name": {
      "description": "Label to tell endpoints apart.",
      "type": [
        "string",
        "null"
      ],
      "example": "ERP"
    },
    "url": {
      "description": "URL that receives the events; `https` is required for a new or changed URL.",
      "type": "string",
      "format": "uri",
      "example": "https://example.com/webhooks/assinafy"
    },
    "email": {
      "description": "Contact email for delivery-failure notices.",
      "type": "string",
      "format": "email",
      "example": "signer@example.invalid"
    },
    "events": {
      "description": "Event types delivered to this endpoint (see **List webhook event types**).",
      "type": "array",
      "items": {
        "type": "string"
      },
      "example": [
        "document_ready",
        "signer_signed_document"
      ]
    },
    "is_active": {
      "description": "Whether events are delivered to this endpoint.",
      "type": "boolean",
      "example": true
    },
    "is_held": {
      "description": "Whether deliveries are paused after 10 failures in a row: we probe the endpoint on a growing schedule and deliver what it missed when it answers (see **Delivery contract**). Editing the URL, or sending `is_active: true`, lifts the pause.",
      "type": "boolean",
      "example": false
    },
    "held_since": {
      "description": "When the pause began (Unix timestamp, seconds); `null` while deliveries run.",
      "type": [
        "integer",
        "null"
      ],
      "example": null
    },
    "signing_enabled": {
      "description": "Whether deliveries carry a `webhook-signature` header (see **Webhook Payloads → Verifying signatures**).",
      "type": "boolean",
      "example": true
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-10-01T12:00:00Z"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "example": "2026-10-01T12:00:00Z"
    }
  },
  "type": "object"
}
```

### `schemas/WebhookEvent`

```json
{
  "description": "Body of every webhook delivery. Timestamps in the body (`created_at`, and the `*_at` fields of `subject`/`object`) are Unix timestamps in seconds, not the ISO strings the REST responses use. `subject` and `object` are serialized from their current state when the delivery is sent.",
  "required": [
    "id",
    "event",
    "created_at",
    "subject",
    "object",
    "account_id"
  ],
  "properties": {
    "id": {
      "description": "ID of the activity that produced the event.",
      "type": "integer",
      "example": 184467
    },
    "event": {
      "description": "Event type. See **List webhook event types**.",
      "type": "string",
      "example": "signer_viewed_document"
    },
    "message": {
      "description": "Reserved; currently always `null`.",
      "type": [
        "string",
        "null"
      ],
      "example": null
    },
    "payload": {
      "description": "Event-specific parameters; keys vary per event.",
      "type": [
        "object",
        "null"
      ],
      "additionalProperties": true
    },
    "origin": {
      "description": "Where the action came from, when it was triggered by a request.",
      "properties": {
        "ip": {
          "type": "string",
          "example": "203.0.113.7"
        },
        "user-agent": {
          "type": "string",
          "example": "Mozilla/5.0"
        }
      },
      "type": [
        "object",
        "null"
      ]
    },
    "created_at": {
      "description": "When the event was recorded (Unix timestamp, seconds).",
      "type": "integer",
      "example": 1790000000
    },
    "subject": {
      "description": "Who performed the action: a `User`, `Signer` or `Account`, plus a `type` property naming it.",
      "type": "object",
      "additionalProperties": true
    },
    "object": {
      "description": "What the action was performed on: a `Document`, `Signer` or `Template` with its relations expanded, plus a `type` property naming it.",
      "type": "object",
      "additionalProperties": true
    },
    "account_id": {
      "description": "ID of the account that owns the event.",
      "type": "string",
      "example": "65f1c2a9b3e4d5f6"
    }
  },
  "type": "object"
}
```

## Webhook deliveries

Assinafy `POST`s every subscribed event to the endpoint URL, `<functions URL>/assinafy/webhook?token=<token>`, with the `schemas/WebhookEvent` body. Signature subscriptions are `signer_signed_document`, `signer_rejected_document`, `user_rejected_document`, `document_ready`, `document_processing_failed`, `signer_identity_verified`, `signer_identity_verification_failed`, `signer_identity_review_required`, `signer_identity_review_approved` and `signer_identity_review_rejected`. Contract subscriptions are `document_contract_updated`, `document_contract_renewal_notice`, `document_contract_expiring`, `document_contract_expired`, `document_contract_renewed`, `document_contract_terminated`, `document_contract_amended` and `document_contract_amendment_updated`. Each has a `Document` as `object`.

Signed endpoints add the Standard Webhooks headers below; the app verifies them with `WebhookVerifier.verifySignature(rawBody, headers)` (HMAC-SHA256 over `{webhook-id}.{webhook-timestamp}.{rawBody}`, five-minute replay window). After authentication, the app reads only `account_id`, `event`, `object.type` and `object.id`. It finds the matching Twenty document in the endpoint's account and re-reads `contracts.get` for a contract event, or `documents.details` for a signature event. Contract events also refresh certificated and other final signature records. Payload terms, signer information and other body fields are never used or stored; duplicate deliveries only repeat the read. Existing endpoints on the app's own route acquire these subscriptions during reconciliation.

Headers:

```json
[
  {
    "name": "webhook-id",
    "in": "header",
    "required": true,
    "description": "Message ID: the same on every attempt of this event to this endpoint. Use it to deduplicate retries.",
    "schema": {
      "type": "string"
    },
    "example": "9f86d081884c7d659a2feaa0c55ad015"
  },
  {
    "name": "webhook-timestamp",
    "in": "header",
    "required": true,
    "description": "Unix timestamp (seconds) of this attempt.",
    "schema": {
      "type": "string"
    },
    "example": "1790000000"
  },
  {
    "name": "webhook-signature",
    "in": "header",
    "required": false,
    "description": "Sent only when signing is enabled on the endpoint: `v1,<base64 HMAC-SHA256>`. See **Verifying signatures**.",
    "schema": {
      "type": "string"
    },
    "example": "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="
  }
]
```

Example body:

```json
{
  "id": 184467,
  "event": "document_ready",
  "message": null,
  "payload": null,
  "origin": null,
  "account_id": "65f1c2a9b3e4d5f6",
  "subject": {
    "type": "Account",
    "id": "65f1c2a9b3e4d5f6"
  },
  "object": {
    "type": "Document",
    "id": "9b2f1c0d4e5a6b7c8d9e0f1a2b3c4d5e",
    "status": "certificated"
  },
  "created_at": 1790000000
}
```

Responses from the app: `200` with `{ "outcome": "synced" | "ignored" | "failed" }` once the delivery authenticates (the periodic sync retries already tracked records; opening the contract panel discovers terms after a failed first contract event), `401` with `{ "outcome": "unauthorized" }` for an unknown token or a missing or invalid signature.

## Error behavior in the app

`ValidationError` becomes `INVALID_INPUT`. HTTP 401 becomes `RECONNECT_REQUIRED`; 403 with an `insufficient_scope` challenge becomes `INSUFFICIENT_SCOPE`; other 403 responses become `FORBIDDEN`. HTTP 404 is `NOT_FOUND`, and 429 is `RATE_LIMITED`. Other definitive 4xx rejections become `PROVIDER_REJECTED` with a sanitized provider message.

Timeouts, network failures, 5xx and HTTP 408 are `PROVIDER_UNAVAILABLE` for reads and ordinary mutations, and `UNCERTAIN` for billable calls. HTTP 409 and unexpected billable responses also become `UNCERTAIN`. The SENDING record is kept for reconciliation. A confirmed provider send remains successful even if the subsequent Twenty update fails.

A document that Assinafy reports as `failed` after confirmed sending or assignment remains `UNKNOWN` with `DOCUMENT_PROCESSING_FAILED` and continues polling; it may later become `certificated`. A definite unsent failure remains `FAILED`. Existing records with send evidence and no recorded local error receive the same recovery behavior. Neither recovery path makes an assigned document eligible for draft deletion.

Contract reads treat HTTP 404 as absent terms. Contract routes map a stale local revision or HTTP 409 to `CONTRACT_CHANGED`, and a 403 without an insufficient-scope challenge to `CONTRACT_UNAVAILABLE`. Contract mutations disable SDK retries. A lost, timed-out, server-error or malformed success response becomes `CONTRACT_UNCERTAIN`; the member must refresh before continuing. `updated_at` and the renewal `term` remain the original preconditions, so refreshing does not replay the mutation. Other definitive rejections retain the shared error mapping above.

The app's member POST routes expose the `{ ok, ... }` envelope described in [SETUP.md](../SETUP.md#request-flow), with HTTP 200. They do not expose the provider's raw response body. Member-visible messages are selected in Brazilian Portuguese by `get-error-message.util.ts`; persistent status-only messages are selected by `get-status-hints.util.ts`.
