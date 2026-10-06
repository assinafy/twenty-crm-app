# Assinafy API integration reference

This reference covers every Assinafy SDK method called by the shipped Twenty app, plus the OAuth token endpoint handled by Twenty. The full SDK resource reference for operations outside this app is available in [the official TypeScript SDK documentation](https://github.com/assinafy/typescript-sdk/tree/main/docs). Use the [live Assinafy API reference](https://api.assinafy.com.br/v1/docs) and [OpenAPI document](https://api.assinafy.com.br/v1/docs/openapi.json) as the contract authority.

## Transport and authentication

The application calls `https://api.assinafy.com.br/v1` over HTTPS. OAuth consent uses `https://auth.assinafy.com.br/oauth/authorize`. Only the live suite uses `https://sandbox.assinafy.com.br/v1`; the end-to-end harness rewrites a temporary app copy to its simulator.

`AssinafyClient` receives either `apiKey` (sent as `X-Api-Key`) or `token` (sent as `Authorization: Bearer`). Never supply both. The resolved workspace ID is set as the client's `accountId`. The default timeout is 30 seconds and safe reads can retry twice. The installed SDK does not replay billable assignment, template creation or resend calls. The app wraps those calls with `billable` to preserve uncertain outcomes.

Successful JSON HTTP responses use `{ "status": 200, "message": "", "data": ... }`. Single-resource SDK methods return `data` directly; list methods return `{ data, meta }`. `meta` comes from `X-Pagination-Current-Page`, `X-Pagination-Total-Count`, `X-Pagination-Page-Count` and `X-Pagination-Per-Page`. Downloads return bytes. OAuth responses have their own payloads.

## Signing payloads

All identifiers and contact data below are synthetic. Replace them with values resolved for the selected workspace. Expiration must be at least 65 minutes ahead when this app sends. A1 and A3 use the same `DigitalCertificate` API value; the certificate stays with its owner.

Signer creation:

```json
{"full_name":"Ana Exemplo","email":"ana@example.invalid","whatsapp_phone_number":"+5511900000000"}
```

The WhatsApp phone is omitted for email invitations. A certificate signer additionally receives this update before assignment:

```json
{"government_id":"11144477735"}
```

The government ID is sent only to Assinafy and is never persisted in Twenty. Email verification uses `["Email"]`; WhatsApp verification uses `["Whatsapp"]`; certificate verification accepts either channel. Exactly one notification channel is sent per signer. The app assigns contiguous steps starting at 1 whenever a certificate signer is present, or when the member selects sequential signing.

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

## OAuth requests and responses

The authorization redirect requests `response_type=code`, the exact registered redirect URI `<SERVER_URL>/auth/apps/callback`, all six app scopes, a fresh `state`, and PKCE `code_challenge_method=S256`. Twenty owns this flow; server variables configure a confidential client. `offline_access` provides a rotating refresh token. Each grant covers one workspace.

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
{"access_token":"ACCESS_TOKEN","token_type":"Bearer","expires_in":3600,"scope":"documents:read documents:write templates:read templates:write account:read offline_access","refresh_token":"REPLACEMENT_REFRESH_TOKEN"}
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

No body. Returns void. For cancellation, 404 means already removed; 400 means Assinafy refused the operation. For draft cleanup, account, assignment, status and Twenty references are checked before deletion.

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
                  "items": []
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
            "type": "string"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "whatsapp_phone_number": {
            "type": "string"
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

### `signers.update(signerId, patch)`

`PUT /v1/accounts/{accountId}/signers/{signerId}`

Returns the unwrapped signer. The app changes full_name, a WhatsApp invitation phone, and government_id for certificate verification; it never changes email. Channel changes can invalidate earlier links and codes; verified in-flight channels cannot be changed.

Parameters:

```json
[
  {
    "$ref": "#/components/parameters/AccountId"
  },
  {
    "name": "signerId",
    "in": "path",
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
            "type": "string"
          },
          "email": {
            "type": "string",
            "format": "email"
          },
          "whatsapp_phone_number": {
            "type": "string"
          },
          "government_id": {
            "type": "string"
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
            "type": "string",
            "enum": [
              "virtual",
              "collect"
            ]
          },
          "signers": {
            "type": "array",
            "items": {
              "properties": {
                "verification_method": {
                  "type": "string",
                  "enum": [
                    "Email",
                    "Whatsapp",
                    "DigitalCertificate"
                  ]
                },
                "notification_methods": {
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
            "type": "string",
            "enum": [
              "virtual",
              "collect"
            ]
          },
          "signers": {
            "type": "array",
            "items": {
              "required": [
                "id"
              ],
              "properties": {
                "id": {
                  "type": "string"
                },
                "verification_method": {
                  "type": "string",
                  "enum": [
                    "Email",
                    "Whatsapp",
                    "DigitalCertificate"
                  ]
                },
                "notification_methods": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "Email",
                      "Whatsapp"
                    ]
                  }
                },
                "step": {
                  "type": "integer"
                }
              },
              "type": "object"
            }
          },
          "entries": {
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
            "type": "string"
          },
          "expires_at": {
            "type": "string",
            "format": "date-time"
          },
          "copy_receivers": {
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
            "type": "array",
            "items": {
              "required": [
                "role_id"
              ],
              "properties": {
                "role_id": {
                  "type": "string"
                },
                "verification_method": {
                  "type": "string",
                  "enum": [
                    "Email",
                    "Whatsapp",
                    "DigitalCertificate"
                  ]
                },
                "notification_methods": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
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
            "type": "array",
            "items": {
              "required": [
                "role_id",
                "id"
              ],
              "properties": {
                "role_id": {
                  "type": "string"
                },
                "id": {
                  "type": "string"
                },
                "verification_method": {
                  "type": "string",
                  "enum": [
                    "Email",
                    "Whatsapp",
                    "DigitalCertificate"
                  ]
                },
                "notification_methods": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "step": {
                  "type": "integer"
                }
              },
              "type": "object"
            }
          },
          "editor_fields": {
            "type": "array",
            "items": {
              "required": [
                "field_id",
                "value"
              ],
              "properties": {
                "field_id": {
                  "type": "string"
                },
                "value": {
                  "type": "string"
                }
              },
              "type": "object"
            }
          },
          "name": {
            "type": "string"
          },
          "message": {
            "type": "string"
          },
          "expires_at": {
            "type": "string",
            "format": "date-time"
          },
          "tags": {
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
    "required": true,
    "schema": {
      "type": "string"
    }
  },
  {
    "name": "signerId",
    "in": "path",
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
    "required": true,
    "schema": {
      "type": "string"
    }
  },
  {
    "name": "signerId",
    "in": "path",
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
  "200": {},
  "401": {
    "content": {
      "application/json": {
        "schema": {
          "properties": {
            "error": {
              "type": "string"
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
    "content": {
      "application/json": {
        "schema": {
          "properties": {
            "access_token": {
              "type": "string"
            },
            "issued_token_type": {
              "type": "string"
            },
            "token_type": {
              "type": "string"
            },
            "expires_in": {
              "type": "integer"
            },
            "refresh_token": {
              "type": "string",
              "nullable": true
            },
            "scope": {
              "type": "string"
            },
            "id_token": {
              "type": "string",
              "nullable": true
            }
          },
          "type": "object"
        }
      }
    }
  },
  "400": {
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
    "content": {
      "application/json": {
        "schema": {
          "properties": {
            "error": {
              "type": "string"
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
  "500": {
    "$ref": "#/components/responses/ServerError"
  }
}
```

## Shared payload schemas

### `parameters/AccountId`

```json
{
  "name": "accountId",
  "in": "path",
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
  "schema": {
    "type": "integer",
    "minimum": 1
  }
}
```

### `parameters/PerPage`

```json
{
  "name": "per-page",
  "in": "query",
  "schema": {
    "type": "integer",
    "maximum": 100
  }
}
```

### `parameters/Search`

```json
{
  "name": "search",
  "in": "query",
  "schema": {
    "type": "string"
  }
}
```

### `responses/NotFound`

```json
{
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
                "type": "integer"
              },
              "message": {
                "type": "string"
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
                "type": "integer"
              },
              "message": {
                "type": "string"
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
                "type": "integer"
              },
              "message": {
                "type": "string"
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
                "type": "integer"
              },
              "message": {
                "type": "string"
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
  "properties": {
    "resource": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "primary_color": {
      "type": "string",
      "nullable": true
    },
    "secondary_color": {
      "type": "string",
      "nullable": true
    },
    "notification_sender_type": {
      "type": "string",
      "enum": [
        "User",
        "Account"
      ]
    },
    "roles": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "is_delete_allowed": {
      "type": "boolean"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "type": "object"
}
```

### `schemas/Assignment`

```json
{
  "properties": {
    "resource": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "sender_email": {
      "type": "string",
      "format": "email"
    },
    "method": {
      "type": "string",
      "enum": [
        "virtual",
        "collect"
      ]
    },
    "expires_at": {
      "type": "string",
      "format": "date-time",
      "nullable": true
    },
    "message": {
      "type": "string",
      "nullable": true
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
        }
      ],
      "nullable": true
    },
    "signer": {
      "type": "object"
    },
    "field": {
      "type": "object",
      "nullable": true
    },
    "display_settings": {},
    "value": {
      "nullable": true
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
  "type": "object",
  "allOf": [
    {
      "$ref": "#/components/schemas/Signer"
    },
    {
      "properties": {
        "verification_method": {
          "type": "string",
          "nullable": true
        },
        "notification_methods": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "nullable": true
        },
        "step": {
          "type": "integer",
          "nullable": true
        },
        "notified": {
          "type": "boolean",
          "nullable": true
        },
        "completed": {
          "type": "boolean",
          "nullable": true
        },
        "notification_history": {
          "type": "array",
          "items": {
            "$ref": "#/components/schemas/NotificationHistoryEntry"
          },
          "nullable": true
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
  "properties": {
    "documents": {
      "type": "integer"
    },
    "credits": {
      "type": "number"
    },
    "needs_extra_document": {
      "type": "boolean"
    },
    "extra_document_cost": {
      "type": "number"
    },
    "total_credits": {
      "type": "number"
    },
    "breakdown": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/CostEstimateBreakdownItem"
      }
    },
    "document_balance": {
      "type": "number"
    },
    "credit_balance": {
      "type": "number"
    },
    "has_sufficient_resources": {
      "type": "boolean"
    },
    "blocking_reason": {
      "type": "string",
      "enum": [
        "PendingPayment",
        "InsufficientDocuments",
        "InsufficientCredits"
      ],
      "nullable": true
    },
    "message": {
      "type": "string",
      "nullable": true
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
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "cost": {
      "type": "number"
    },
    "quantity": {
      "type": "integer"
    },
    "unit_cost": {
      "type": "number"
    }
  },
  "type": "object"
}
```

### `schemas/DisplaySettings`

```json
{
  "required": [
    "left",
    "top",
    "width",
    "height",
    "fontSize"
  ],
  "properties": {
    "left": {
      "type": "number",
      "format": "float",
      "minimum": 0
    },
    "top": {
      "type": "number",
      "format": "float",
      "minimum": 0
    },
    "width": {
      "type": "number",
      "format": "float",
      "exclusiveMinimum": true,
      "minimum": 0
    },
    "height": {
      "type": "number",
      "format": "float",
      "exclusiveMinimum": true,
      "minimum": 0
    },
    "fontFamily": {
      "type": "string"
    },
    "fontSize": {
      "type": "number",
      "format": "float",
      "exclusiveMinimum": true,
      "minimum": 0
    },
    "backgroundColor": {
      "type": "string"
    }
  },
  "type": "object"
}
```

### `schemas/Document`

```json
{
  "properties": {
    "resource": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "account_id": {
      "type": "string"
    },
    "template_id": {
      "type": "string",
      "nullable": true
    },
    "name": {
      "type": "string"
    },
    "status": {
      "type": "string"
    },
    "artifacts": {
      "type": "object"
    },
    "is_closed": {
      "type": "boolean"
    },
    "signing_url": {
      "type": "string"
    },
    "decline_reason": {
      "type": "string",
      "nullable": true
    },
    "declined_by": {
      "oneOf": [
        {
          "$ref": "#/components/schemas/Signer"
        }
      ],
      "nullable": true
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
      "nullable": true,
      "allOf": [
        {
          "$ref": "#/components/schemas/Assignment"
        }
      ]
    },
    "pages": {
      "type": "array",
      "items": {
        "$ref": "#/components/schemas/DocumentPage"
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

### `schemas/DocumentPage`

```json
{
  "properties": {
    "id": {
      "type": "string"
    },
    "number": {
      "type": "integer"
    },
    "height": {
      "type": "integer"
    },
    "width": {
      "type": "integer"
    },
    "download_url": {
      "type": "string"
    }
  },
  "type": "object"
}
```

### `schemas/Envelope`

```json
{
  "properties": {
    "status": {
      "type": "integer"
    },
    "message": {
      "type": "string"
    }
  },
  "type": "object"
}
```

### `schemas/ErrorEnvelope`

```json
{
  "properties": {
    "status": {
      "type": "integer"
    },
    "message": {
      "type": "string"
    },
    "data": {
      "type": "object",
      "nullable": true
    }
  },
  "type": "object"
}
```

### `schemas/NotificationHistoryEntry`

```json
{
  "properties": {
    "event": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "sent",
        "failed"
      ]
    },
    "error_code": {
      "type": "string",
      "nullable": true
    },
    "error_message": {
      "type": "string",
      "nullable": true
    },
    "sent_at": {
      "type": "string",
      "format": "date-time",
      "nullable": true
    },
    "failed_at": {
      "type": "string",
      "format": "date-time",
      "nullable": true
    }
  },
  "type": "object"
}
```

### `schemas/OAuthRevokeRequest`

```json
{
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
  "required": [
    "grant_type",
    "client_id"
  ],
  "properties": {
    "grant_type": {
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
      "type": "string"
    },
    "refresh_token": {
      "type": "string"
    },
    "client_id": {
      "type": "string"
    },
    "client_secret": {
      "type": "string"
    },
    "resource": {
      "type": "string",
      "format": "uri"
    },
    "subject_token": {
      "type": "string"
    },
    "subject_token_type": {
      "type": "string",
      "enum": [
        "urn:ietf:params:oauth:token-type:access_token"
      ]
    },
    "requested_token_type": {
      "type": "string",
      "enum": [
        "urn:ietf:params:oauth:token-type:access_token"
      ]
    }
  },
  "type": "object"
}
```

### `schemas/Signer`

```json
{
  "properties": {
    "resource": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "full_name": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email",
      "nullable": true
    },
    "whatsapp_phone_number": {
      "type": "string",
      "nullable": true
    },
    "has_accepted_terms": {
      "type": "boolean"
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
      "type": "string"
    }
  },
  "type": "object"
}
```

### `schemas/Template`

```json
{
  "properties": {
    "resource": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "document_name": {
      "type": "string",
      "nullable": true
    },
    "message": {
      "type": "string",
      "nullable": true
    },
    "status": {
      "type": "string"
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

### `schemas/TemplatePage`

```json
{
  "properties": {
    "id": {
      "type": "string"
    },
    "number": {
      "type": "integer"
    },
    "height": {
      "type": "integer"
    },
    "width": {
      "type": "integer"
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
    "display_settings": {},
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

### `schemas/TemplateRole`

```json
{
  "properties": {
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "assignment_type": {
      "type": "string"
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

## Error behavior in the app

`ValidationError` becomes `INVALID_INPUT`. HTTP 401 becomes `RECONNECT_REQUIRED`; 403 with an `insufficient_scope` challenge becomes `INSUFFICIENT_SCOPE`; other 403 responses become `FORBIDDEN`. HTTP 404 is `NOT_FOUND`, and 429 is `RATE_LIMITED`. Other definitive 4xx rejections become `PROVIDER_REJECTED` with a sanitized provider message.

Timeouts, network failures, 5xx and HTTP 408 are `PROVIDER_UNAVAILABLE` for reads and ordinary mutations, and `UNCERTAIN` for billable calls. HTTP 409 and unexpected billable responses also become `UNCERTAIN`. The SENDING record is kept for reconciliation. A confirmed provider send remains successful even if the subsequent Twenty update fails.

The app's seven POST routes expose the `{ ok, ... }` envelope described in [SETUP.md](../SETUP.md#request-flow), with HTTP 200. They do not expose the provider's raw response body. Member-visible messages are selected in Brazilian Portuguese by `get-error-message.util.ts`; persistent status-only messages are selected by `get-status-hints.util.ts`.
