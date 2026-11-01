# Chat-Brain Backend API

A lightweight, single-user, local-first backend built with FastAPI and SQLite.

## Overview

- **Port & Host**: Runs locally on `http://127.0.0.1:8000` (strictly local binding).
- **Frontend Port**: Runs on `http://localhost:3000` (`strictPort: true`).
- **Python Requirement**: Python 3.12 is preferred (minimum Python >= 3.11 required). `scripts/setup-api.mjs` selects `py -3.12` on Windows, then `python3.12`, then `python`, failing loudly if the interpreter is older than 3.11.
- **Database**: SQLite database stored at `data/app.db` with idempotent SQL migrations (`001_settings.sql`, `002_model_registry.sql`, `003_chat.sql`). Foreign key enforcement is enabled (`PRAGMA foreign_keys=ON;`).
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
  - Structured logging that automatically sanitizes and redacts secrets and credentials.

---

## Directory Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py             # Endpoints: /health, /bootstrap, /settings, /credentials, /models
│   ├── db/
│   │   ├── migrations/           # 001_settings.sql, 002_model_registry.sql
│   │   ├── database.py           # SQLite connection & WAL management
│   │   └── migrations.py         # Idempotent migration runner
│   ├── services/
│   │   ├── ai/
│   │   │   ├── provider.py       # AIProvider Protocol & ModelInfo
│   │   │   └── gemini_provider.py# Google GenAI SDK implementation
│   │   ├── key_store.py          # Write-only key persistence (data/secrets/gemini.key)
│   │   └── model_registry.py     # SQLite cache for discovered models
│   ├── config.py                 # Settings via pydantic-settings
│   ├── errors.py                 # Centralized exception models (validation, auth, not_found, provider, internal)
│   ├── logging_config.py         # Structured JSON logging with secret scrubbing
│   ├── main.py                   # FastAPI application, CORS, and security middleware
│   └── security.py               # Per-startup token and Host header verification
├── tests/
│   ├── __init__.py
│   ├── conftest.py               # Isolated test fixtures and FakeProvider
│   ├── test_api.py               # Core API & security tests
│   └── test_credentials_models.py# Credentials & model discovery tests
├── requirements.txt              # Pinned backend dependencies
└── README.md
```

---

## API Endpoints (`/api/v1`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | No | Returns backend status, version, and DB connectivity. |
| `GET` | `/api/v1/bootstrap` | No | Returns ephemeral session token for state mutations. |
| `GET` | `/api/v1/settings` | Yes (`X-ChatBrain-Token`) | Retrieves all stored settings key-value pairs. |
| `PUT` | `/api/v1/settings/{key}` | Yes (`X-ChatBrain-Token`) | Stores or updates a setting key-value pair. |
| `GET` | `/api/v1/credentials/gemini` | Yes (`X-ChatBrain-Token`) | Returns `{configured: bool, hint: str \| null}` (4 chars). |
| `PUT` | `/api/v1/credentials/gemini` | Yes (`X-ChatBrain-Token`) | Validates key upstream, saves write-only, returns hint. |
| `DELETE`| `/api/v1/credentials/gemini` | Yes (`X-ChatBrain-Token`) | Removes key file and clears cached models from DB. |
| `POST`| `/api/v1/credentials/gemini/test` | Yes (`X-ChatBrain-Token`) | Tests saved key with provider (no secrets in message). |
| `POST`| `/api/v1/models/refresh` | Yes (`X-ChatBrain-Token`) | Discovers models from provider and replaces DB cache. |
| `GET` | `/api/v1/models` | Yes (`X-ChatBrain-Token`) | Returns cached models list with computed `kind` & `kind_inferred`, plus `default_chat_model`. |
| `GET` | `/api/v1/models/default` | Yes (`X-ChatBrain-Token`) | Returns `{model_id, valid, reason}` for default chat model. |
| `PUT` | `/api/v1/models/default` | Yes (`X-ChatBrain-Token`) | Sets default chat model; rejects non-chat unless `force=true`. |
| `DELETE`| `/api/v1/models/default` | Yes (`X-ChatBrain-Token`) | Clears the default chat model selection. |
| `GET` | `/api/v1/status` | Yes (`X-ChatBrain-Token`) | System status (health, DB, Python, key status, models count, last success/error). |
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

### Model Kind Classification Rules (`derive_kind`)

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
