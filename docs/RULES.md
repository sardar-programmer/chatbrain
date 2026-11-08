# Chat-Brain Rules (read before every task)
0. Product rule: before building anything ask (1) does it directly help a data-science student, (2) can it live in the backend without UI, (3) can it fit an existing screen; no placeholder pages; no model names in the chat UI.
1. Do ONLY the requested step. Do not build ahead. Do not touch unrelated files.
2. Never fake anything: no fake execution, metrics, models or replies. Unavailable = honest empty/error state.
3. Design: flat, warm, calm (Claude-like). No glass, blur, gradients, glow. Light+Dark. Colors only via tokens, never raw hex.
4. Code: TypeScript strict, no `any`, Python type hints, files under 250 lines, no duplicated logic, no new dependency without a one-line justification.
5. Security: never log or return the API key; localhost only; validate input; sanitize Markdown (no raw HTML).
6. Chat UX rules: composer has NO focus ring, the strip around it is transparent; rename/pin never change updatedAt; storage load never overwrites data; saves while streaming are throttled (~300ms).
7. Quota saving: open only the files you need, do not re-read the whole repo, do not run browser/screenshot checks unless asked; run lint + build + tests once.
8. When done: list changed files, commit with a clear message, update PROJECT_STATE.md, then STOP.
