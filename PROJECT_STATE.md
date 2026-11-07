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
  - M1.3a (chat database + CRUD backend: migration 003 conversations & messages tables, indexes, cascading foreign keys, raw sqlite3 service with cursor pagination, literal search escaping, auto-title, rename/pin preserving updated_at, edit-user-message trimming later messages, soft delete & restore, 7-day startup purge, interrupted message recovery, 10 typed endpoints requiring X-ChatBrain-Token, 59 pytest tests passing)
  - M1.3b (real Gemini streaming with SSE status events: stream_chat async protocol & GeminiProvider implementation, pure error classifier mapping provider errors to standard codes with retryable flags, POST /conversations/{id}/reply emitting typed SSE events [message_created, status, delta, done, error, stopped], single-stream lock returning 409 Conflict, 30-message context window, 300ms throttled DB persistence, ping heartbeats every 15s idle, client disconnect cancellation, secret-scrubbed logging, 88 pytest tests passing; M1.3b stop-lock bug fixed: lock now released on all exit paths (disconnect/GeneratorExit/error/timeout/GC), 97 pytest tests passing)
  - M1.3c (automatic model failover + hedging + model health backend: migration 004 model_health & failover_events tables, ModelHealthStore with EWMA TTFT alpha 0.3, cooldown rules [quota 60s/retry-after up to 300s, unavailable 20s, timeout 30s, network 15s, not_found 600s cleared on refresh], consecutive failure doubling, pure rank_candidates pool prioritizing response speed with default model first, silent selection without leaking model names to SSE, hedging with parallel attempt after 3s where fastest wins and loser is cancelled without penalty, multi-round backoff retries [3s, 6s, 10s...] with retrying status events, 90s total budget limit returning all_models_unavailable error, GET /api/v1/models/health & POST /api/v1/models/health/scan endpoints, dev fault injection wrapper with CHATBRAIN_ENV=dev, all files strictly under 250 lines, 115 pytest tests passing, vitest 23 tests green, eslint 0 warnings, verified build)
- Next: M1.3d (Chat UI with real streaming, optimistic sends, auto-scroll, stop reply, regenerate, error states)

## Decisions (do not re-debate)
- Frontend: React + Vite + TypeScript + Tailwind + shadcn, plain SPA (no SSR), strict port 3000
- Backend: Python 3.12 preferred (Python >= 3.11 required), FastAPI in /backend; SQLite file in /data (gitignored)
- Gemini key lives ONLY in backend (data/secrets/gemini.key), write-only via API, never in the frontend, never in DB
- No hardcoded model names; models come from API discovery
- Backend binds 127.0.0.1 only; state-changing requests and protected endpoints need the per-startup token
- Frontend API client note: must re-fetch /bootstrap and retry once on 401 because the token changes whenever the server reloads
- Streaming & Failover Design (M1.3b & M1.3c):
  - M1.3b = real Gemini streaming with SSE status events
  - M1.3c = automatic failover across ALL available "chat"-kind models (chosen silently by the backend, tried in turn; default model first), with cooldowns and a time budget; if all fail the UI shows a retry state. Schema migration 003 (with attempts JSON list and error_category) and 004 (model_health & failover_events) fully implement this.
- File constraint: Keep all backend files strictly under 250 lines.

## Slices
M1 Chat -> M2 Data Science -> M3 Python/SQL labs -> M4 Projects/Memory/Files -> M5 later extras

## Known issues / notes
- Windows permissions note: POSIX mode bits (0o700, 0o600) on data/secrets and gemini.key are not strictly enforced by standard Windows NTFS ACLs, but the files are gitignored and bound 100% locally.
