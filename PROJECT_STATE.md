# Chat-Brain: Project State
Personal, single-user, 100% local app. No cloud, no auth, no telemetry.
Target user: Data-science student. Focused study assistant and tutor.
Project location: D:\Projects\chat-brain

## Scope & Screens
- Final screens:
  - Chat (home `/` & `/chat/:id`)
  - Settings (`/settings`)
  - Datasets (`/datasets` - M2)
- RULE: No placeholder pages, no sidebar entries for unbuilt screens, no model names in chat UI. Python execution removed from roadmap: Python is taught by the AI, not executed.

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
  - C0b (backend cleanup: trimmed API to 23 endpoints; deleted pool_routes.py and unused endpoints GET/PATCH /models/pool, POST /models/health/scan, POST /models/health/reset, GET /models/failovers, GET /status, GET /settings, PUT /settings/{key}; simplified rank_candidates and failover_runner by removing excluded parameter; kept SQLite failover_events writes as internal debug log; kept internal settings helpers; added guard test asserting exact route set; 112 pytest unit/integration tests passing; all files strictly under 250 lines)
  - C1 (small cleanup: frontend appearance exists only in Settings > Appearance; removed ThemeToggle from AppShell/Sidebar and deleted component; Settings simplified to exactly Gemini API key and Appearance; removed PreferredModelSection, useDefaultModel, useModels, and client model types/functions; backend removed GET/PUT/DELETE /models/default and default_model logic; failover engine ranks candidates purely by known TTFT ascending, then fewer consecutive failures, then id; auto model discovery on key save [failure logs error code without failing key save], lazy discovery on empty cache in reply path [max 10s], background refresh when cache older than 24h; exact 20 endpoints guarded; all files strictly under 250 lines)
  - G1 (glass UI foundation: static CSS .app-bg gradient background, floating 72px glass-rail sidebar defaulting to collapsed with logo toggle and pinned settings, Newsreader serif welcome screen with accent .glass-icon-tile, .glass-composer with disabled + and mic tools, accent-colored .glass-chips, .glass-card settings sections, light & dark theme support, zero raw hex in components, all files strictly under 250 lines)
  - G2 (visual fixes: outlined logo mark, crossfade to PanelLeftOpen on collapsed logo hover/focus, expanded header row with serif wordmark and PanelLeftClose rail-btn, hairline divider, ghost .rail-btn buttons; 4 suggestion chips in single row at >=1024px with 900px max width; chat screen non-sticky 14px title, removal of top bar, avatars, and model names; plain-text assistant messages with ghost action buttons, .msg-user bubble; max-w-3xl shared column and composer width; glass-composer--chat variant; small muted status text with pulsing dot; all files strictly under 250 lines)
  - M1.4a (chat reply reliability: robust SSE parser handling chunks, CRLF, joined data lines and ping comments; pure error message mapper sanitizing JSON/tracebacks/API keys/model names; module-level stream store keyed by conversation ID with live countdown timers and optimistic user messages; TanStack Query as single source of truth without unmount aborts; ChatErrorCard with retry & settings actions; ChatMessage supporting all 6 states [waiting, streaming, retrying, done, stopped, error]; fixes P1 empty screen, P2 retry sending new message, P3 stopped indicator, and P4 error visibility; all files strictly under 250 lines)
  - M1.4b (streaming feel + remaining chat fixes: fixed regression where all-at-once rendering occurred by using immutable store updates for useSyncExternalStore change detection and rendering live assistant bubble during stream; delta batching via requestAnimationFrame; terminal swap waiting for refetch before deleting live state; errors before reply [auth/missing key, empty pool, 409, network] rendered under user message; persisted unanswered state with soft 'No reply yet.' panel and Retry sending {regenerate:true}; stick-to-bottom scroll tracking with 80px threshold and Jump to latest pill; dynamic composer bottom padding via ResizeObserver; status line directly under user bubble with 10px gap hidden on first delta; soft light orange disabled send button with visible icon; memoized ChatMessage and CodeBlock with useThrottledText for Markdown performance; all files strictly under 250 lines)
  - M1.4c (chat polish: jump to latest pill positioned absolute bottom-full mb-3 inside composer wrapper; composer width matched exactly to message column max-w-3xl px-4; composer bg opacity increased in glass.css; backend regenerate_from deletes specified assistant message and later turns in one transaction then regenerates reply; frontend Regenerate on any answer with ConfirmDialog showing N messages to remove; smooth word-by-word reveal via useSmoothText and nextRevealIndex with ~18 to 60 wps adaptive draining and instant reveal on reduced-motion/server load/stopped/hidden; all files strictly under 250 lines)
  - M1.4d (sidebar chat actions: search input with 200ms debounce and Escape/X clear; Pinned heading + date groups Today/Yesterday/Previous 7 days/Older by updated_at via pure groupConversations helper; Show more pagination 50/page cursor; SidebarChatItem with custom controlled menu Rename Pin/Unpin Delete no Radix portal plain click-triggered; inline rename Enter saves valid title Escape/blur cancels empty rejected max 200 chars; delete aborts stream soft-deletes navigates to / if active shows 6s Undo toast + restore; Edit & resend on user messages inline textarea Ctrl+Enter saves Escape cancels confirm dialog when later msgs exist PATCH + empty-body reply never adds user message; backend delete-while-streaming consistency test; 16 frontend test files 82 tests 114 backend tests; all files strictly under 250 lines)
- Next: M1.5 (DS tutor prompt and study chips)

## Roadmap
- C0a: Frontend cleanup (DONE)
- C0b: Backend cleanup (DONE)
- C1: Small cleanup (DONE)
- G1: Glass UI foundation (DONE)
- G2: Visual fixes (DONE)
- M1.4a: Chat reply reliability (DONE)
- M1.4b: Streaming feel + remaining chat fixes (DONE)
- M1.4c: Chat polish (DONE)
- M1.4d: Sidebar chat actions (DONE)
- M1.5: DS tutor prompt and study chips
- M1.5: DS tutor prompt and study chips
- M2a: Datasets backend
- M2b: Datasets screen with "Ask AI about this dataset"
- Later (only when asked): PDF/notes Q&A, projects, export, quiz mode

## Decisions (do not re-debate)
- Frontend: React + Vite + TypeScript + Tailwind + shadcn, plain SPA (no SSR), strict port 3000
- Backend: Python 3.12 preferred (Python >= 3.11 required), FastAPI in /backend; SQLite file in /data (gitignored)
- Gemini key lives ONLY in backend (data/secrets/gemini.key), write-only via API, never in the frontend, never in DB
- No hardcoded model names; models come from API discovery
- Backend binds 127.0.0.1 only; state-changing requests and protected endpoints need the per-startup token
- Frontend API client note: must re-fetch /bootstrap and retry once on 401 because the token changes whenever the server reloads
- Chat UI NEVER shows model names or failover switches (silent selection by backend).
- File constraint: Keep all files strictly under 250 lines across backend and frontend.

## Known issues / notes
- Windows permissions note: POSIX mode bits (0o700, 0o600) on data/secrets and gemini.key are not strictly enforced by standard Windows NTFS ACLs, but the files are gitignored and bound 100% locally.
