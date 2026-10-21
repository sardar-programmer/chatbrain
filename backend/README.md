# Chat-Brain Backend API

A lightweight, single-user, local-first backend built with FastAPI and SQLite.

## Overview

- **Port & Host**: Runs locally on `http://127.0.0.1:8000` (strictly local binding).
- **Frontend Port**: Runs on `http://localhost:3000` (`strictPort: true`).
- **Database**: SQLite database stored at `data/app.db` with idempotent SQL migrations (`001_settings.sql`, `002_model_registry.sql`).
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
| `GET` | `/api/v1/models` | Yes (`X-ChatBrain-Token`) | Returns cached models list or empty with `connected:false`. |

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
