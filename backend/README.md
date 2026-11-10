# Chat-Brain Backend API

A lightweight, single-user, local-first backend built with FastAPI and SQLite.

## Overview

- **Port & Host**: Runs locally on `http://127.0.0.1:8000` (strictly local binding).
- **Frontend Port**: Runs on `http://localhost:3000` (`strictPort: true`).
- **Python Requirement**: Python 3.12 preferred (minimum Python >= 3.11 required). `scripts/setup-api.mjs` selects `py -3.12` on Windows, then `python3.12`, then `python`, failing if older than 3.11.
- **Database**: SQLite database stored at `data/app.db` with idempotent SQL migrations (`001_settings.sql` .. `004_model_health_failover.sql`). Foreign key enforcement is enabled (`PRAGMA foreign_keys=ON;`).
- **Key Storage**:
  - The Gemini API key is stored strictly on disk at `data/secrets/gemini.key` (`data/` is gitignored).
  - The key is **WRITE-ONLY**: never returned by any endpoint (only a 4-char hint is exposed), never logged, never included in error messages, and never saved in the database.
- **Security & Auth**:
  - Ephemeral random per-startup token generated on backend launch (`GET /api/v1/bootstrap`).
  - Protected endpoints require the `X-ChatBrain-Token` header.
  - Strict `Host` header validation (rejects any request not targeted to `localhost` or `127.0.0.1`).
  - CORS whitelist restricted to local dev origins (`http://localhost:3000`, `http://127.0.0.1:3000`).
  - Structured logging that sanitizes and redacts secrets, credentials, and message content.

---

## Directory Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── chat_routes.py        # /conversations, /messages, /reply (streaming)
│   │   ├── health_routes.py      # /models/health (debug)
│   │   ├── models_routes.py      # /models, /models/refresh (debug)
│   │   └── routes.py             # /health, /bootstrap, /credentials
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
│   │   ├── key_store.py          # Write-only key persistence (data/secrets/gemini.key)
│   │   ├── model_registry.py     # SQLite cache for discovered models
│   │   └── settings_store.py     # SQLite key-value settings store
│   ├── config.py                 # Settings via pydantic-settings
│   ├── errors.py                 # Centralized exception models
│   ├── logging_config.py         # Structured JSON logging with secret scrubbing
│   ├── main.py                   # FastAPI application, CORS, lifespan, security middleware
│   └── security.py               # Per-startup token and Host header verification
├── tests/                        # Comprehensive pytest test suite
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
| `PUT` | `/api/v1/credentials/gemini` | Yes (`X-ChatBrain-Token`) | Validates key upstream, saves write-only, auto-discovers models. |
| `DELETE`| `/api/v1/credentials/gemini` | Yes (`X-ChatBrain-Token`) | Removes key file and clears cached models from DB. |
| `POST`| `/api/v1/credentials/gemini/test` | Yes (`X-ChatBrain-Token`) | Tests saved key with provider (no secrets in message). |
| `GET` | `/api/v1/models` | Yes (`X-ChatBrain-Token`) | Cached models with computed kind (debug endpoint). |
| `POST`| `/api/v1/models/refresh` | Yes (`X-ChatBrain-Token`) | Discovers models from provider and replaces DB cache (debug). |
| `GET` | `/api/v1/models/health` | Yes (`X-ChatBrain-Token`) | Metrics, EWMA TTFT, cooldowns, and ranked candidates (debug). |
| `GET` | `/api/v1/conversations` | Yes (`X-ChatBrain-Token`) | List conversations ordered by pinned DESC, updated_at DESC. |
| `POST`| `/api/v1/conversations` | Yes (`X-ChatBrain-Token`) | Create conversation with optional title. |
| `GET` | `/api/v1/conversations/{id}` | Yes (`X-ChatBrain-Token`) | Retrieve conversation with messages ordered by seq. |
| `PATCH`| `/api/v1/conversations/{id}` | Yes (`X-ChatBrain-Token`) | Rename or pin conversation (never changes updated_at). |
| `DELETE`| `/api/v1/conversations/{id}` | Yes (`X-ChatBrain-Token`) | Soft delete conversation (sets deleted_at). |
| `POST`| `/api/v1/conversations/{id}/restore` | Yes (`X-ChatBrain-Token`) | Restores soft-deleted conversation. |
| `POST`| `/api/v1/conversations/clear` | Yes (`X-ChatBrain-Token`) | Soft deletes all non-deleted conversations. |
| `POST`| `/api/v1/conversations/restore` | Yes (`X-ChatBrain-Token`) | Batch restore soft-deleted conversations by IDs. |
| `POST`| `/api/v1/conversations/{id}/messages` | Yes (`X-ChatBrain-Token`) | Add user message (auto-titles if first message). |
| `PATCH`| `/api/v1/messages/{id}` | Yes (`X-ChatBrain-Token`) | Edit user message (deletes subsequent messages). |
| `POST`| `/api/v1/conversations/{id}/reply` | Yes (`X-ChatBrain-Token`) | Stream assistant reply via SSE with automatic failover. |

---

## Automatic Failover, Hedging & Auto Discovery (C1)

### Design & Behavior
- **Silent Model Selection**: The backend selects models silently. SSE events never expose model names or reveal that a switch occurred (`model_used` is stored internally in SQLite for diagnostics).
- **Auto Model Discovery**:
  - Saving a valid Gemini key automatically triggers discovery and caches models.
  - In the reply path, if the key is configured and cache is empty, lazy discovery runs once (max 10s).
  - If the cache is older than 24h, it is refreshed in the background without delaying the reply.
- **Speed Priority Ranking**: Available candidates (chat-kind models not in cooldown) are ranked by:
  1. Known EWMA Time-To-First-Token (TTFT) ascending (neutral median initial TTFT is 2000ms).
  2. Fewer consecutive failures ascending.
  3. Model ID ascending.
- **Failover Scope**:
  - Applies **ONLY** to retryable errors: `quota`, `unavailable`, `not_found`, `timeout`, `network`.
  - **NEVER** occurs on non-retryable errors: `invalid_key`, `safety_blocked`, `bad_request` (execution halts immediately).
- **Hedging**: If the first token has not arrived within `hedge_delay` (3.0s), a second attempt is launched in parallel with the next candidate in the pool (`max_parallel = 2`). The first candidate to emit a token wins; the loser is cancelled without failure penalty.
- **Rounds & Backoff**: Retries in rounds with progressive backoff (3s, 6s, 10s...) and notifies the UI with `retrying` status events until the 90s total budget is exhausted.
- **Cooldowns**:
  - `quota`: 60s (or upstream Retry-After header, up to 300s)
  - `unavailable`: 20s, `timeout`: 30s, `network`: 15s, `not_found`: 600s
  - Exponential doubling: $\ge 3$ consecutive failures double cooldown duration up to 300s.

---

## SSE Streaming Protocol (`/api/v1/conversations/{id}/reply`)

The reply endpoint streams assistant responses over HTTP using Server-Sent Events (`text/event-stream`).

#### Concurrency & Validation
- **Single-Stream Lock**: Only one active stream per conversation at a time (`HTTP 409 Conflict` on concurrent requests).
- **Validation**: Requests with empty content on an empty conversation return `HTTP 422 Unprocessable Entity`.
- **Heartbeats**: Every 15s of idle time without a chunk, an SSE comment (`: ping\n\n`) is sent.
- **Persistence**: Assistant text is persisted to SQLite every ~300ms during streaming and finalized upon completion.

#### Event Types
| Event | Payload | Description |
|---|---|---|
| `message_created` | `{"user_message_id": str, "assistant_message_id": str}` | Emitted after message validation. |
| `status` | `{"phase": str, "text": str, ...}` | Lifecycle phases: `preparing`, `connecting`, `waiting_first_token`, `retrying`. |
| `delta` | `{"text": str}` | Incremental token delta from the AI model. |
| `done` | `{"message_id": str, "status": "done"}` | Emitted when streaming completes normally. |
| `error` | `{"category": str, "code": str, "message": str, "retryable": bool, "message_id": str \| null}` | Emitted on error or failure. |
| `stopped` | `{"message_id": str}` | Emitted if client disconnects mid-stream. |

---

## Model Kind Classification Rules (`derive_kind`)

Model functional kinds are classified at read-time (never persisted) using API-reported metadata:
1. `predictLongRunning` in actions -> `"video"` (`kind_inferred: true`)
2. `bidiGenerateMusic` in actions -> `"music"` (`kind_inferred: false`)
3. `embedContent` or `embedText` in actions -> `"embeddings"` (`kind_inferred: false`)
4. `generateAnswer` in actions -> `"qa"` (`kind_inferred: false`)
5. `bidiGenerateContent` in actions without `generateContent` -> `"live"` (`kind_inferred: false`)
6. ID contains `"transcribe"` -> `"transcribe"` (`kind_inferred: true`)
7. ID contains `"lyria"` -> `"music"` (`kind_inferred: true`)
8. ID contains `"antigravity"` or `"computer-use"` -> `"agent"`; `"deep-research"` -> `"research"`; `"robotics"` -> `"robotics"` (`kind_inferred: true`)
9. `generateContent` in actions and capability `"image"` -> `"image"`; capability `"audio"` -> `"audio"` (`kind_inferred: false`)
10. `generateContent` in actions otherwise -> `"chat"` (`kind_inferred: false`)
11. Otherwise -> `"unknown"` (`kind_inferred: false`)

---

## Quickstart Scripts

All commands are runnable from the repository root:

- **Setup virtual environment & dependencies**: `npm run setup:api`
- **Run backend development server**: `npm run dev:api`
- **Run backend test suite**: `npm run test:api`
- **Run both UI and Backend concurrently**: `npm run dev`
