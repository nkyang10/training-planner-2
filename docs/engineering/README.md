# Engineering — PoC2

## Stack

| Piece | Choice |
|---|---|
| Runtime | Node 24 (TypeScript, `tsx`) |
| HTTP | `node:http`, no framework |
| Storage | `node:sqlite` (synchronous), one file `data/poc2.sqlite` |
| Tests | vitest 2.1.9 |
| Chat UI | **Open WebUI** (Docker, `:3010`) |
| Coach model | OpenAI-compatible endpoint, `poc2-coach`, served by our gateway |
| Calendar UI | our own server, `:8091` |
| Coach gateway | OpenAI-compatible server, `:8090` |

## Architecture

```
browser ── Open WebUI :3010 ──► coach gateway :8090 ──► local model (dgx/general)
                  │                    │
                  │                    ├─ memories (append-only)
                  │                    ├─ sessions  (validated, future only)
                  │                    └─ activities (Garmin / chat)
                  │
                  └─ the chat product        calendar :8091 ── SQLite data/poc2.sqlite
```

Open WebUI is the chat surface, and its native Calendar is the in-product schedule view: booked sessions are mirrored
into it as all-day events (`src/openwebui-calendar.ts`, ADR-0004). The research behind that choice is in
[`embedding-research.md`](embedding-research.md). The calendar embeds a small chat bubble that calls `POST /chat` on the calendar
origin, which proxies to the same gateway (ADR-0003). The gateway is registered as the OpenAI model `poc2-coach`, so every chat turn
carries the runner's memories, upcoming sessions and Garmin activities; the model answers with one JSON turn that the
gateway validates before writing.

## Run

```powershell
pnpm install
$env:POC2_TOKENS='{"demo-token":"demo-runner"}'
$env:POC2_DB='sqlite:data/poc2.sqlite'
$env:POC2_MODEL_BASE_URL='http://192.168.1.202:8102/v1'
$env:POC2_MODEL_API_KEY='<local model key>'
$env:POC2_MODEL_NAME='dgx/general'
$env:POC2_CALENDAR_URL='http://192.168.1.162:8091/calendar'
$env:GARMIN_PERSONAL_API_KEY='<Garmin personal API key>'
npx tsx src/index.ts
```

| URL | What |
|---|---|
| http://127.0.0.1:3010 | Open WebUI chat |
| http://127.0.0.1:8090/v1 | coach gateway (OpenAI-compatible) |
| http://127.0.0.1:8091/calendar | private calendar (dev token `demo-token`) |

## Native calendar mirror

Set `OPENWEBUI_URL`, `OPENWEBUI_EMAIL`, `OPENWEBUI_PASSWORD` and optionally `POC2_TIMEZONE_OFFSET` (default `+08:00`).
After a validated turn books sessions, the gateway creates or updates one all-day event per session on the user's default
calendar. Events carry `meta.poc2_session_id`, so re-planning updates instead of duplicating. A mirror failure does not
lose the booking in PoC2's SQLite.

## Calendar auto-refresh

`GET /calendar/data?month=YYYY-MM` returns `{month, days: {day: {sessions, activities}}}` for the signed-in runner.
The in-calendar bubble calls it after a booking and re-renders the `.cell[data-day]` chips and Garmin badges in place; a
failed refresh leaves the page unchanged (the booking is already stored).

## Gates

```powershell
node tools/lint.mjs     # no console/TODO/any/secrets in src
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest
```

## Open WebUI wiring

See [`open-webui.md`](open-webui.md) for the exact container command, the admin config call that registers
`poc2-coach`, and the first-user signup.

## Notes

- `node:sqlite` is loaded with `createRequire` because Vite 5 (pinned by vitest 2.1) does not externalize
  `node:sqlite`; the API is identical.
- The gateway is bound to `127.0.0.1`; Open WebUI reaches it with `host.docker.internal`.
- The calendar is read-only for the runner. The coach is the only writer of planned sessions; Garmin is the only
  completer.
