# Chat-Brain: Project State
Personal, single-user, 100% local app. No cloud, no auth, no telemetry.
Target user: Data-science student. Focused study assistant and tutor.

## Scope & Screens
- Final screens:
  - Chat (home `/` & `/chat/:id`)
  - Settings (`/settings`)
  - Datasets (`/datasets` - M2)
  - Code Lab (`/code-lab` - M3)
- RULE: No placeholder pages, no sidebar entries for unbuilt screens, no model names in chat UI.

## Current
- Slice: M1 (Chat with real local backend)
- Done:
  - U1 (UI foundation: shell, sidebar, theme, routes, collapsed layout, no scrollbar/hover shift)
  - M1.1 (backend skeleton: FastAPI, SQLite migrations, startup token security, health/bootstrap/settings endpoints, pytest suite, cross-platform dev scripts)
  - M1.2a (Gemini credentials + model discovery backend: AIProvider protocol, google-genai provider, write-only data/secrets/gemini.key, model_registry migration 002, provider error category, Swagger Authorize, 15 pytest unit/integration tests)
  - M1.2b (model kind classification with derive_kind, default chat model settings/endpoints, GET /status endpoint, Python 3.12 setup preference, 44 pytest unit/integration tests)
  - M1.2c (frontend: API client with ephemeral session token + single 401 retry, TanStack Query hooks, real API Management, Models, and System Status views, Home status line, Vitest tests for apiClient & modelFilter, zero lint errors, verified build)
  - M1.3a (chat database + CRUD backend: migration 003 conversations & messages tables, indexes, cascading foreign keys, raw sqlite3 service with cursor pagination, literal search escaping, auto-title, rename/pin preserving updated_at, edit-user-message trimming later messages, soft delete & restore, 7-day startup purge, interrupted message recovery, 10 typed endpoints requiring X-ChatBrain-Token, 59 pytest tests passing)
  - M1.3b (real Gemini streaming with SSE status events: stream_chat async protocol & GeminiProvider implementation, pure error classifier mapping provider errors to standard codes with retryable flags, POST /conversations/{id}/reply emitting typed SSE events [message_created, status, delta, done, error, stopped], single-stream lock returning 409 Conflict, 30-message context window, 300ms throttled DB persistence, ping heartbeats every 15s idle, client disconnect cancellation, secret-scrubbed logging, 88 pytest tests passing; M1.3b stop-lock bug fixed: lock now released on all exit paths (disconnect/GeneratorExit/error/timeout/GC), 97 pytest tests passing)
  - M1.3c (automatic model failover + hedging + model health backend: migration 004 model_health & failover_events tables, ModelHealthStore with EWMA TTFT alpha 0.3, cooldown rules [quota 60s/retry-after up to 300s, unavailable 20s, timeout 30s, network 15s, not_found 600s cleared on refresh], consecutive failure doubling, pure rank_candidates pool prioritizing response speed with default model first, silent selection without leaking model names to SSE, hedging with parallel attempt after 3s where fastest wins and loser is cancelled without penalty, multi-round backoff retries [3s, 6s, 10s...] with retrying status events, 90s total budget limit returning all_models_unavailable error, GET /api/v1/models/health & POST /api/v1/models/health/scan endpoints, dev fault injection wrapper with CHATBRAIN_ENV=dev, all files strictly under 250 lines, 115 pytest tests passing)
  - M1.3d (auto-pool controls backend: GET /api/v1/models/pool, PATCH /api/v1/models/pool/{model_id}, POST /api/v1/models/health/reset, GET /api/v1/models/failovers, GET /api/v1/status updated with pool_summary & failover_count_24h, 123 pytest tests passing)
  - C0a (frontend cleanup: removed placeholder feature folders and deleted technical pages [ModelsView, StatusView, auto-pool UI, poolHelpers, useModelPool, modelFilter]; reduced navigation to Logo, New chat, Chats empty text, Settings, Theme toggle; simplified routes to `/`, `/chat/:id`, `/settings`, `*`; reorganized Settings into ApiKeySection, PreferredModelSection, AppearanceSection; cleaned API client & types; updated Sidebar tests and added PreferredModelSection tests; all files strictly under 250 lines)
- Next: M1.4a (Chat screen with real streaming, optimistic sends, auto-scroll, stop reply, regenerate, error states - no model names in UI)

## Roadmap
- C0a: Frontend cleanup (DONE)
- C0b: Backend cleanup (prune unused endpoints if needed)
- M1.4a: Chat screen with real streaming, optimistic sends, auto-scroll, stop reply, regenerate, error states
- M1.4b: Chat extras (conversations sidebar list, auto-title, search, pin, rename, delete)
- M1.5: DS tutor prompt and study chips
- M2a: Datasets backend
- M2b: Datasets screen with "Ask AI about this dataset"
- M3a: Code runner backend
- M3b: Code Lab
- Later (only when asked): PDF/notes Q&A, projects, export, quiz mode

## Decisions (do not re-debate)
- Frontend: React + Vite + TypeScript + Tailwind + shadcn, plain SPA (no SSR), strict port 3000
- Backend: Python 3.12 preferred (Python >= 3.11 required), FastAPI in /backend; SQLite file in /data (gitignored)
- Gemini key lives ONLY in backend (data/secrets/gemini.key), write-only via API, never in the frontend, never in DB
- No hardcoded model names; models come from API discovery
- Backend binds 127.0.0.1 only; state-changing requests and protected endpoints need the per-startup token
- Frontend API client note: must re-fetch /bootstrap and retry once on 401 because the token changes whenever the server reloads
- Chat UI NEVER shows model names or failover switches (silent selection by backend; optional preferred model tried first).
- File constraint: Keep all files strictly under 250 lines across backend and frontend.

## Known issues / notes
- Windows permissions note: POSIX mode bits (0o700, 0o600) on data/secrets and gemini.key are not strictly enforced by standard Windows NTFS ACLs, but the files are gitignored and bound 100% locally.
