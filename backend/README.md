# Chat-Brain Backend API

A lightweight, single-user, local-first backend built with FastAPI and SQLite.

## Overview

- **Port & Host**: Runs locally on `http://127.0.0.1:8000` (strictly local binding).
- **Frontend Port**: Runs on `http://localhost:3000` (`strictPort: true`).
- **Python Requirement**: Python 3.12 is preferred (minimum Python >= 3.11 required). `scripts/setup-api.mjs` selects `py -3.12` on Windows, then `python3.12`, then `python`, failing loudly if the interpreter is older than 3.11.
- **Database**: SQLite database stored at `data/app.db` with idempotent SQL migrations (`001_settings.sql`, `002_model_registry.sql`, `003_chat.sql`, `004_model_health_failover.sql`). Foreign key enforcement is enabled (`PRAGMA foreign_keys=ON;`).
- **Key Storage**:
  - The Gemini API key is stored strictly on disk at `data/secrets/gemini.key`.
  - `data/` is gitignored.
  - The key is **WRITE-ONLY**: never returned by any endpoint (only a 4-char hint is exposed), never logged, never included in error messages, and never saved in the database.
  - **Permissions Note**: On POSIX operating systems, permissions are restricted with `0o700` on `data/secrets/` and `0o600` on `gemini.key`. On Windows, standard POSIX mode bits do not alter NTFS Access Control Lists (ACLs); full ACL restrictions on Windows require explicit icacls/DACL configuration, but the file remains strictly local and excluded from version control.
- **Security & Auth**:
  - Ephemeral random per-startup token generated on backend launch.
  - Clients fetch the token via `GET /api/v1/bootstrap`.
  - All state-changing operations (`PUT`, `POST`, `DELETE`, `PATCH`), credentials management, and models endpoints require the `X-ChatBrain-Token` header.
  - Swagger UI exposes `X-ChatBrain-Token` as an apiKey security scheme for interactive testing.
  - Strict `Host` header validation (rejects any request not targeted to `localhost` or `127.0.0.1`).
  - CORS whitelist restricted to local dev origins (`http://localhost:3000`, `http://127.0.0.1:3000`).
  - Structured logging that automatically sanitizes and redacts secrets, credentials, and user message content.

---

## Directory Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── chat_routes.py        # Endpoints: /conversations, /messages, /reply (streaming)
│   │   ├── health_routes.py      # Endpoints: /models/health, /models/health/scan
│   │   ├── models_routes.py      # Endpoints: /models, /models/refresh, /models/default
│   │   ├── pool_routes.py        # Endpoints: /models/pool, /models/health/reset, /models/failovers
│   │   └── routes.py             # Endpoints: /health, /bootstrap, /settings, /credentials, /status
│   ├── db/
│   │   ├── migrations/           # 001_settings.sql .. 004_model_health_failover.sql
│   │   ├── database.py           # SQLite connection & WAL management
│   │   └── migrations.py         # Idempotent migration runner
│   ├── schemas/
│   │   └── core.py               # Shared Pydantic request/response models
│   ├── services/
│   │   ├── ai/
│   │   │   ├── dev_fault_wrapper.py # Dev fault/latency injection (CHATBRAIN_ENV=dev)
│   │   │   ├── gemini_provider.py# Google GenAI SDK async streaming implementation
│   │   │   ├── model_health.py   # In-memory ModelHealthStore (EWMA TTFT, cooldowns)
│   │   │   ├── model_pool.py     # Pure model ranking (speed priority, cooldown aware)
│   │   │   └── provider.py       # AIProvider Protocol, ModelInfo & derive_kind
│   │   ├── chat/
│   │   │   ├── chat_context.py   # Context window builder (last 30 messages)
│   │   │   ├── chat_store.py     # Conversations & messages SQLite CRUD
│   │   │   ├── chat_stream_session.py # StreamLockOwner & concurrency locks
│   │   │   ├── chat_streamer.py  # SSE coordinator & disconnect safety
│   │   │   ├── error_classifier.py# Pure classifier for provider error codes & retryable flags
│   │   │   ├── failover_attempt.py# ModelAttempt lifecycle, runner task, cancellation
│   │   │   ├── failover_config.py # Timing parameters (hedge delay, timeouts, budget, backoff)
│   │   │   ├── failover_events.py # failover_events DB recording
│   │   │   ├── failover_runner.py # Multi-model failover loop & round backoff
│   │   │   ├── failover_stream.py # Winning stream consumer & DB finalizer
│   │   │   └── prompts.py        # System prompt definition
│   │   ├── default_model.py      # Default chat model resolution & validation
│   │   ├── key_store.py          # Write-only key persistence (data/secrets/gemini.key)
│   │   ├── model_registry.py     # SQLite cache for discovered models
│   │   └── settings_store.py     # SQLite key-value settings store
│   ├── config.py                 # Settings via pydantic-settings
│   ├── errors.py                 # Centralized exception models
│   ├── logging_config.py         # Structured JSON logging with secret scrubbing
│   ├── main.py                   # FastAPI application, CORS, lifespan, security middleware
│   └── security.py               # Per-startup token and Host header verification
├── tests/
│   ├── __init__.py
│   ├── conftest.py               # Isolated test fixtures and FakeProvider
│   ├── test_api.py               # Core API & security tests
│   ├── test_chat_api.py          # Chat CRUD HTTP endpoints
│   ├── test_chat_context.py      # Context windowing tests
│   ├── test_chat_lifecycle.py    # Soft delete, restore, recovery tests
│   ├── test_chat_store.py        # Chat store unit tests
│   ├── test_chat_streaming.py    # SSE streaming integration tests
│   ├── test_chat_streaming_concurrency.py # Lock 409 & timeout tests
│   ├── test_chat_streaming_disconnect.py  # Disconnect handling tests
│   ├── test_chat_streaming_lock_release.py# Lock release safety tests
│   ├── test_chat_streaming_safety.py      # Content safety & persistence tests
│   ├── test_credentials_models.py# Credentials & model discovery tests
│   ├── test_error_classifier.py  # Error code & retryable classification tests
│   ├── test_failover_hedging.py  # Hedging, disconnect, budget exhaustion tests
│   ├── test_failover_streaming.py# Failover routing & non-retryable blocks tests
│   ├── test_model_health_api.py  # /models/health & /models/health/scan tests
│   ├── test_model_health_pool.py # Health store & model pool ranking tests
│   ├── test_model_kind_status.py # Model kind classifier & status tests
│   └── test_model_pool_api.py    # Auto-pool controls, health reset, failovers tests
├── requirements.txt              # Pinned backend dependencies
└── README.md
```

---

## API Endpoints (`/api/v1`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | No | Returns backend status, version, and DB connectivity. |
| `GET` | `/api/v1/bootstrap` | No | Returns ephemeral session token for state mutations. |
| `GET` | `/api/v1/credentials/gemini` | Yes (`X-ChatBrain-Token`) | Returns `{configured: bool, hint: str \| null}` (4 chars). |
| `PUT` | `/api/v1/credentials/gemini` | Yes (`X-ChatBrain-Token`) | Validates key upstream, saves write-only, returns hint. |
| `DELETE`| `/api/v1/credentials/gemini` | Yes (`X-ChatBrain-Token`) | Removes key file and clears cached models from DB. |
| `POST`| `/api/v1/credentials/gemini/test` | Yes (`X-ChatBrain-Token`) | Tests saved key with provider (no secrets in message). |
| `GET` | `/api/v1/models` | Yes (`X-ChatBrain-Token`) | Returns cached models list with computed `kind` & `kind_inferred`, plus `default_chat_model`. |
| `POST`| `/api/v1/models/refresh` | Yes (`X-ChatBrain-Token`) | Discovers models from provider and replaces DB cache. |
| `GET` | `/api/v1/models/default` | Yes (`X-ChatBrain-Token`) | Returns `{model_id, valid, reason}` for default chat model. |
| `PUT` | `/api/v1/models/default` | Yes (`X-ChatBrain-Token`) | Sets default chat model; rejects non-chat unless `force=true`. |
| `DELETE`| `/api/v1/models/default` | Yes (`X-ChatBrain-Token`) | Clears the default chat model selection. |
| `GET` | `/api/v1/models/health` | Yes (`X-ChatBrain-Token`) | Returns metrics, EWMA TTFT, cooldowns, and ranked candidates pool. |
| `GET` | `/api/v1/conversations` | Yes (`X-ChatBrain-Token`) | List conversations ordered by pinned DESC, updated_at DESC (search & cursor pagination). |
| `POST`| `/api/v1/conversations` | Yes (`X-ChatBrain-Token`) | Create conversation with optional title. |
| `GET` | `/api/v1/conversations/{id}` | Yes (`X-ChatBrain-Token`) | Retrieve conversation with messages ordered by seq. |
| `PATCH`| `/api/v1/conversations/{id}` | Yes (`X-ChatBrain-Token`) | Rename or pin conversation (never changes updated_at). |
| `DELETE`| `/api/v1/conversations/{id}` | Yes (`X-ChatBrain-Token`) | Soft delete conversation (sets deleted_at). |
| `POST`| `/api/v1/conversations/{id}/restore` | Yes (`X-ChatBrain-Token`) | Restores soft-deleted conversation. |
| `POST`| `/api/v1/conversations/clear` | Yes (`X-ChatBrain-Token`) | Soft deletes all non-deleted conversations. |
| `POST`| `/api/v1/conversations/restore` | Yes (`X-ChatBrain-Token`) | Batch restore soft-deleted conversations by IDs. |
| `POST`| `/api/v1/conversations/{id}/messages` | Yes (`X-ChatBrain-Token`) | Add user message (auto-titles if first message; updates updated_at). |
| `PATCH`| `/api/v1/messages/{id}` | Yes (`X-ChatBrain-Token`) | Edit user message (deletes subsequent messages, sets edited_at). |
| `POST`| `/api/v1/conversations/{id}/reply` | Yes (`X-ChatBrain-Token`) | Stream assistant reply via Server-Sent Events (SSE) with automatic failover. |

---

## Automatic Failover, Hedging & Model Health (M1.3c)

### Design & Behavior
- **Silent Model Selection**: The backend selects models silently. SSE events never expose model names or reveal that a switch occurred (`model_used` is stored internally in SQLite for diagnostics).
- **Speed Priority**: The candidate pool is ranked by EWMA Time-To-First-Token (TTFT) ascending (neutral median initial TTFT is 2000ms), followed by consecutive failure count.
- **Default Model First**: When a user's default chat model is configured, valid, and not cooling down, it is attempted first; otherwise the top-ranked model from the pool is chosen.
- **Failover Scope**:
  - Failover applies **ONLY** to retryable errors: `quota`, `unavailable`, `not_found`, `timeout`, `network`.
  - Failover **NEVER** occurs on non-retryable errors: `invalid_key`, `safety_blocked`, `bad_request` (execution halts immediately with the classified error).
- **Hedging**: If the first token has not arrived within `hedge_delay` (3.0s), a second attempt is launched in parallel with the next candidate in the pool (`max_parallel = 2`). The first candidate to emit a token becomes the winner; the losing attempt is cancelled and closed with no failure penalty.
- **Rounds & Backoff**: If all candidates fail or enter cooldown, the engine retries in rounds with progressive backoff (3s, 6s, 10s...) and notifies the UI with `retrying` status events until the total budget is exhausted.
- **Time Budget**: Configured to 90 seconds. If the budget expires before any model responds, an error event with code `all_models_unavailable` is emitted (`retryable: true`) and the user's prompt is preserved.
- **Cooldowns**:
  - `quota`: 60s (or upstream Retry-After header, capped at 300s)
  - `unavailable`: 20s
  - `timeout`: 30s
  - `network`: 15s
  - `not_found`: 600s (cleared on manual or automatic `/models/refresh`)
  - Exponential doubling: $\ge 3$ consecutive failures double cooldown duration up to 300s.
- **Dev-Only Fault Injection**:
  When `CHATBRAIN_ENV=dev`, the provider is wrapped in `DevFaultWrapper` (logging `DEV fault injection ACTIVE` at startup). Supports comma-separated model IDs via `CHATBRAIN_DEV_FAIL_MODELS` and `CHATBRAIN_DEV_SLOW_MODELS` to simulate upstream failures and hedging delays deterministically.

---

## SSE Streaming Protocol (`/api/v1/conversations/{id}/reply`)

The reply endpoint streams assistant responses over HTTP using Server-Sent Events (`text/event-stream`).

#### Concurrency & Validation
- **Single-Stream Lock**: Only one active stream is permitted per conversation at a time. A concurrent reply request immediately returns `HTTP 409 Conflict` (`{error: {category: "conflict", message: "..."}}`).
- **Validation**: Requests with empty content on an empty conversation or invalid turn state return `HTTP 422 Unprocessable Entity` immediately.
- **Heartbeats**: Every 15 seconds of idle time without a chunk, an SSE comment (`: ping\n\n`) is sent to keep connection proxies alive.
- **Persistence**: Assistant text is persisted to SQLite every ~300ms during active streaming and finalized on stream completion.

#### Event Types
| Event | Payload | Description |
|---|---|---|
| `message_created` | `{"user_message_id": string, "assistant_message_id": string}` | Emitted immediately after message validation and assistant row creation. |
| `status` | `{"phase": string, "text": string, ...}` | Emitted during reply lifecycle phases: `preparing`, `connecting`, `waiting_first_token`, `retrying`, `writing`. |
| `delta` | `{"text": string}` | Emitted for each incremental token delta from the AI model. |
| `done` | `{"message_id": string, "status": "done"}` | Emitted when streaming completes normally. Assistant message status updated to `done`. |
| `error` | `{"category": string, "code": string, "message": string, "retryable": bool, "message_id": string \| null}` | Emitted on provider error, timeout, or safety block. Message status updated to `error`. |
| `stopped` | `{"message_id": string}` | Emitted if client disconnects mid-stream. Assistant message status updated to `stopped`. |

#### Example Event Stream
```text
event: message_created
data: {"user_message_id": "06050b1a-05c2-4a0b-9df6-b816a7daee29", "assistant_message_id": "848bb22d-327c-47ea-9ec2-e0892095f462"}

event: status
data: {"phase": "preparing", "text": "Preparing your message"}

event: status
data: {"phase": "connecting", "text": "Connecting"}

event: status
data: {"phase": "waiting_first_token", "text": "Waiting for the first words"}

event: status
data: {"phase": "waiting_first_token", "text": "Still working on it..."}

event: status
data: {"phase": "writing", "text": "Writing the answer"}

event: delta
data: {"text": "Hello"}

event: delta
data: {"text": " world!"}

event: done
data: {"message_id": "848bb22d-327c-47ea-9ec2-e0892095f462", "status": "done"}
```

---

## Model Kind Classification Rules (`derive_kind`)

Model functional kinds are classified at read-time (never persisted) using API-reported metadata in strict priority order:
1. `predictLongRunning` in actions -> `"video"` (`kind_inferred: true` since action is not video-specific)
2. `bidiGenerateMusic` in actions -> `"music"` (`kind_inferred: false`)
3. `embedContent` or `embedText` in actions -> `"embeddings"` (`kind_inferred: false`)
4. `generateAnswer` in actions -> `"qa"` (`kind_inferred: false`)
5. `bidiGenerateContent` in actions without `generateContent` -> `"live"` (`kind_inferred: false`)
6. ID contains `"transcribe"` -> `"transcribe"` (`kind_inferred: true`)
7. ID contains `"lyria"` -> `"music"` (`kind_inferred: true`)
8. ID contains `"antigravity"` or `"computer-use"` -> `"agent"` (`kind_inferred: true`); ID contains `"deep-research"` -> `"research"` (`kind_inferred: true`); ID contains `"robotics"` -> `"robotics"` (`kind_inferred: true`)
9. `generateContent` in actions and capability `"image"` -> `"image"`; capability `"audio"` -> `"audio"` (`kind_inferred: false`)
10. `generateContent` in actions otherwise -> `"chat"` (`kind_inferred: false`)
11. Otherwise -> `"unknown"` (`kind_inferred: false`)

All errors return the standard format:
```json
{
  "error": {
    "category": "validation | auth | not_found | provider | internal",
    "message": "Human-readable description"
  }
}
```

---

## Quickstart Scripts

All commands are runnable from the repository root:

- **Setup virtual environment & dependencies**:
  ```bash
  npm run setup:api
  ```
- **Run backend development server (with hot reload)**:
  ```bash
  npm run dev:api
  ```
- **Run backend test suite**:
  ```bash
  npm run test:api
  ```
- **Run both UI and Backend concurrently**:
  ```bash
  npm run dev
  ```
