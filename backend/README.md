# Chat-Brain Backend API

A lightweight, single-user, local-first backend built with FastAPI and SQLite.

## Overview

- **Port & Host**: Runs locally on `http://127.0.0.1:8000` (strictly local binding).
- **Database**: SQLite database stored at `data/app.db` with idempotent SQL migrations.
- **Security**:
  - Ephemeral random per-startup token generated on backend launch.
  - Clients fetch the token via `GET /api/v1/bootstrap`.
  - State-changing operations (`PUT`, `POST`, `DELETE`, `PATCH`) and `GET /api/v1/settings` require the `X-ChatBrain-Token` header.
  - Strict `Host` header validation (rejects any request not targeted to `localhost` or `127.0.0.1`).
  - CORS whitelist restricted to local dev origins (`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000`, `http://127.0.0.1:3000`).
  - Structured logging that automatically sanitizes and redacts secrets and credentials.

---

## Directory Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py         # Endpoints: /health, /bootstrap, /settings
│   ├── db/
│   │   ├── migrations/       # Sequential SQL migrations (e.g. 001_settings.sql)
│   │   ├── database.py       # Connection management and health check
│   │   └── migrations.py     # Idempotent migration runner
│   ├── config.py             # Settings using pydantic-settings
│   ├── errors.py             # Standard categorized exception model
│   ├── logging_config.py     # Structured JSON logging with secret scrubbing
│   ├── main.py               # FastAPI application, CORS, and security middleware
│   └── security.py           # Per-startup token and Host header verification
├── tests/
│   ├── __init__.py
│   └── test_api.py           # Pytest test suite
├── requirements.txt          # Pinned backend dependencies
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

All errors return the standard format:
```json
{
  "error": {
    "category": "validation | auth | not_found | internal",
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
