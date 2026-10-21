# Chat-Brain: Project State
Personal, single-user, 100% local app. No cloud, no auth, no telemetry.

## Current
- Slice: M1 (Chat with real local backend)
- Done:
  - U1 (UI foundation: shell, sidebar, theme, routes), sidebar fixes (collapsed layout, no scrollbar/hover shift)
  - M1.1 (backend skeleton: FastAPI, SQLite migrations, startup token security, health/bootstrap/settings endpoints, pytest suite, cross-platform dev scripts)
  - M1.2a (Gemini credentials + model discovery backend: AIProvider protocol, google-genai provider, write-only data/secrets/gemini.key, model_registry migration 002, provider error category, Swagger Authorize, 15 pytest unit/integration tests)
  - M1.2b (model kind classification with derive_kind, default chat model settings/endpoints, GET /status endpoint, Python 3.12 setup preference, 44 pytest unit/integration tests)
  - M1.2c (frontend: API client with ephemeral session token + single 401 retry, TanStack Query hooks, real API Management, Models, and System Status views, Home status line, Vitest tests for apiClient & modelFilter, zero lint errors, verified build)
- Next: M1.3 (chat backend with streaming + conversations persistence)

## Decisions (do not re-debate)
- Frontend: React + Vite + TypeScript + Tailwind + shadcn, plain SPA (no SSR), strict port 3000
- Backend: Python 3.12 preferred (Python >= 3.11 required), FastAPI in /backend; SQLite file in /data (gitignored)
- Gemini key lives ONLY in backend (data/secrets/gemini.key), write-only via API, never in the frontend, never in DB
- No hardcoded model names; models come from API discovery
- Backend binds 127.0.0.1 only; state-changing requests and protected endpoints need the per-startup token
- Frontend API client note: must re-fetch /bootstrap and retry once on 401 because the token changes whenever the server reloads

## Slices
M1 Chat -> M2 Data Science -> M3 Python/SQL labs -> M4 Projects/Memory/Files -> M5 later extras

## Known issues / notes
- Windows permissions note: POSIX mode bits (0o700, 0o600) on data/secrets and gemini.key are not strictly enforced by standard Windows NTFS ACLs, but the files are gitignored and bound 100% locally.