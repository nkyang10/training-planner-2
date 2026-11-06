# training-planner — PoC2

PoC2 is **the conversation is the product**. After login the runner talks to an AI coach in a normal chat surface; the
coach remembers facts on its own, builds a periodic training system, and books future sessions into a private calendar.
Garmin activities complete the record, and the next conversation starts from what the coach remembers.

PoC1 is archived at `../training-planner-poc1` (git `540095a`, 842 tests, PRs #66–#90).

## What exists now

| Surface | URL | What it is |
|---|---|---|
| Chat | http://127.0.0.1:3010 | **Open WebUI**, unforked; the coach is the model `poc2-coach` |
| Coach gateway | http://127.0.0.1:8090/v1 | OpenAI-compatible; memory + calendar + validation + model call |
| Private calendar | http://127.0.0.1:8091/calendar | sessions booked by the coach, activities from Garmin; dev token `demo-token` |
| Coach bubble | inside the calendar | floating **💬 Coach** button: quick chat without leaving the calendar; same coach, same memory, same bookings |
| Native calendar | Open WebUI sidebar → Calendar | the coach's sessions are mirrored as all-day events, with reminders, inside Open WebUI |

## Flow

1. Open the chat and say anything. Chit-chat is fine.
2. Say something training-related: goal, days, constraints. The coach replies and books sessions.
3. Open the calendar: future days show the booked sessions; the reply carries the calendar link. Use the **💬 Coach** bubble there for quick turns — when it adds, moves or deletes a session, the month grid updates **in place** with a page-wide animation (the chip flies to its new day, or into the bin). In Open WebUI, **sidebar → Calendar** shows the same sessions natively.
4. Sync Garmin on the calendar; completed activities appear on their days.
5. Come back and ask: the coach references the remembered training and the Garmin activities without being reminded.

## Quick start

```powershell
pnpm install
$env:POC2_TOKENS='{"demo-token":"demo-runner"}'
$env:POC2_DB='sqlite:data/poc2.sqlite'
$env:POC2_MODEL_BASE_URL='http://192.168.1.202:8102/v1'
$env:POC2_MODEL_API_KEY='<local model key>'
$env:POC2_MODEL_NAME='dgx/general'
$env:POC2_CALENDAR_URL='http://192.168.1.162:8091/calendar'
$env:GARMIN_PERSONAL_API_KEY='<Garmin personal API key>'
$env:OPENWEBUI_URL='http://127.0.0.1:3010'
$env:OPENWEBUI_EMAIL='owner@poc2.local'
$env:OPENWEBUI_PASSWORD='<Open WebUI password>'
$env:POC2_TIMEZONE_OFFSET='+08:00'
npx tsx src/index.ts
```

Open WebUI is a container; see [`docs/engineering/open-webui.md`](docs/engineering/open-webui.md) for the exact command,
the admin config call that registers `poc2-coach`, and the first-user signup.

## Schedule CRUD

The coach answers with `action: add | update | remove`. `update`/`remove` carry the existing `sessionId` from the facts. **One turn may contain many actions across many days** (move two runs, delete one, add one); the gateway applies the batch, then mirrors the **final state** of every affected session to the native Open WebUI calendar and prunes native events whose session no longer exists. A missing session id changes nothing and the reply says so. The conversation so far is part of the prompt, so a follow-up like "what did I delete?" works.

## Design decisions

- [`docs/adr/0001-llm-proposes-server-validates.md`](docs/adr/0001-llm-proposes-server-validates.md) — the LLM proposes,
  the server validates, the calendar is the only artefact.
- [`docs/adr/0002-open-webui-chat-surface.md`](docs/adr/0002-open-webui-chat-surface.md) — Open WebUI is the chat
  surface; the gateway is the model.
- [`docs/adr/0003-in-calendar-chat-bubble.md`](docs/adr/0003-in-calendar-chat-bubble.md) — the in-calendar bubble is a
  same-origin client of the gateway, not an iframe of Open WebUI.
- [`docs/adr/0004-native-calendar-mirror.md`](docs/adr/0004-native-calendar-mirror.md) — sessions mirror into Open WebUI's
  native Calendar; no fork and no iframe.

## Gates

```powershell
node tools/lint.mjs
pnpm typecheck
pnpm test
```

## PoC2 repository

https://github.com/nkyang10/training-planner-2

## Status

- [x] PoC1 archived
- [x] PoC2 brief recorded
- [x] Chat-first coach on Open WebUI
- [x] Proactive memory, validated future bookings, private calendar
- [x] Garmin sync into the calendar
- [x] Returning-user recognition
- [x] Native Open WebUI Calendar mirror (no fork, no iframe)
- [ ] Manual calendar editing (deliberately absent: the coach is the only writer)
