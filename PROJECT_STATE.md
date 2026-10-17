# Chat-Brain: Project State
Personal, single-user, 100% local app. No cloud, no auth, no telemetry.

## Current
- Slice: M1 (Chat with real local backend)
- Done:
  - U1 (UI foundation: shell, sidebar, theme, routes), sidebar fixes (collapsed layout, no scrollbar/hover shift)
  - M1.1 (backend skeleton: FastAPI, SQLite migrations, startup token security, health/bootstrap/settings endpoints, pytest suite, cross-platform dev scripts)
- Next: M1.2

## Decisions (do not re-debate)
- Frontend: React + Vite + TypeScript + Tailwind + shadcn, plain SPA (no SSR)
- Backend: Python 3.11+ FastAPI in /backend; SQLite file in /data (gitignored)
- Gemini key lives ONLY in backend (data/secrets), write-only via API, never in the frontend
- No hardcoded model names; models come from API discovery
- Backend binds 127.0.0.1 only; state-changing requests need the per-startup token

## Slices
M1 Chat -> M2 Data Science -> M3 Python/SQL labs -> M4 Projects/Memory/Files -> M5 later extras

## Known issues / notes
- (add here)