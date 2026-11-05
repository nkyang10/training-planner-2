# Research — graceful ways to put the calendar into Open WebUI (or the chat into the calendar)

Date: 2026-11-06. Scope: PoC2. Question: the chat already lives in Open WebUI; what is the most graceful way to make the
training calendar part of that product, without an ugly double-login iframe?

## TL;DR

| Option | Fork? | Calendar inside WebUI? | Effort | Verdict |
|---|---|---|---|---|
| **Native Open WebUI Calendar + API mirror** | No | Yes — sidebar → Calendar, month/week/day, reminders | Low | **Chosen and implemented** |
| Rich UI embed (Tool/Action returns an iframe) | No | Only inside a chat message | Medium | Good add-on for the custom Garmin grid |
| Community chat widget (Open WebUI API key) | No | Chat only | Low | Chat-only; not a calendar |
| iframe + reverse proxy + trusted-header SSO | No | Chat inside our calendar (reverse direction) | Medium | Workable, but double UI and cookie/proxy work |
| Fork the SvelteKit frontend and add a page | **Yes** | Yes, first-class page | High | Only if a bespoke page is a must |

**Recommendation:** do not fork. Use Open WebUI's native Calendar as the in-product calendar, and mirror the coach's
sessions into it through the documented API. Keep PoC2's own calendar (`:8091`) as the source of truth and the Garmin
view. If the bespoke month grid must appear inside chat, add a Rich UI embed later; it is a plugin, not a fork.

## 1. Native Open WebUI Calendar (chosen)

Open WebUI 0.11 ships a personal calendar: month/week/day views, all-day and timed events, RRULE recurrence, reminders,
colour coding, sharing, and agentic tools (`search_calendar_events`, `create_calendar_event`, …) when native function
calling is enabled.

- Docs: [Calendar](https://docs.openwebui.com/features/calendar/)
- API: `GET /api/v1/calendars/`, `GET /api/v1/calendars/events?start=…&end=…`,
  `POST /api/v1/calendars/events/create`, `POST /api/v1/calendars/events/{id}/update`
- Events are stored with **nanosecond** `start_at`/`end_at`; an all-day event uses local midnight × 1e6.
- Limitation stated by the docs: [no external calendar sync](https://docs.openwebui.com/features/calendar/#no-external-calendar-sync)
  (no CalDAV/iCal). That is fine here: the coach is the writer, not Google Calendar.

**Implemented in PoC2:** `src/openwebui-calendar.ts` signs in as the owner, finds the default Personal calendar, lists
events in the booked range, and creates or updates one all-day event per session, keyed by
`meta.poc2_session_id`. A mirror failure never loses the booking in PoC2's SQLite; the chat reply is unaffected.

Live evidence: a Chinese chat turn booked 3 sessions and the native calendar API returned 3 events with
`start_at=1794240000000000000` (2026-11-10 00:00 +08:00) and the matching `poc2_session_id`.

## 2. Rich UI embed (plugin, no fork)

Tools and Actions can return `HTMLResponse` with `Content-Disposition: inline`; Open WebUI renders it as a sandboxed
iframe **inside the chat message**. It can report its height with `postMessage({type:'iframe:height'})`, and with
`allowSameOrigin` it can talk to the parent (prompt submission, args, storage).

- Docs: [Rich UI Element Embedding](https://docs.openwebui.com/features/extensibility/plugin/development/rich-ui/)

**Fit for PoC2:** a `show_training_calendar` tool could return an iframe of our month grid (signed read-only URL), so the
runner can say "show my calendar" and see the Garmin-aware grid inline. It does **not** replace sidebar navigation, and
sandboxed iframes cannot read the calendar's session cookie by default; the embed needs a signed URL or a token in the
query string. It also cannot write to our calendar unless the iframe posts back through a parent bridge.

## 3. Community chat widget (no fork, chat-only)

`taylorwilsdon/open-webui-embeddable-widget` is a ~15 KB self-contained chat widget that calls Open WebUI's
`/api/chat/completions` with an API key. It is a clean chat bubble, not a calendar, and it puts an API key in the page
(their README recommends a backend proxy in production).

- Repo: [open-webui-embeddable-widget](https://github.com/taylorwilsdon/open-webui-embeddable-widget)
- Related discussion: [Embeddable Chat JS Widget](https://github.com/open-webui/open-webui/discussions/19887)

**Fit for PoC2:** the calendar already has our own bubble that talks to the coach gateway; this widget would add a second
chat UI without calendar context. Not chosen.

## 4. iframe + reverse proxy + trusted-header SSO (reverse direction)

Open WebUI does **not** send `X-Frame-Options` unless `XFRAME_OPTIONS` is set (default: header absent), so it can be
framed. The hard part is cookies and login:

- Cross-origin iframes block third-party `SameSite=Lax` cookies; Open WebUI's session cookie would not be sent.
- Trusted-header auth (`WEBUI_AUTH_TRUSTED_EMAIL_HEADER`) behind an authenticating reverse proxy removes the login page;
  the proxy injects `X-User-Email` on every request.
- Same-site subdomains (e.g. `planner.example` + `chat.planner.example`) keep `SameSite=Lax` cookies same-site; a
  same-origin path proxy is harder because Open WebUI has no `ROOT_PATH` (see issue
  [#1162](https://github.com/open-webui/open-webui/issues/1162) and
  [HTTPS/reverse proxy docs](https://docs.openwebui.com/reference/https/)).
- Docs: [SSO / trusted header](https://docs.openwebui.com/features/authentication-access/auth/sso/#trusted-header),
  [XFRAME_OPTIONS](https://docs.openwebui.com/reference/env-configuration/#xframe_options)

**Fit for PoC2:** this is the method for putting the **chat inside the calendar** (our original bubble), not the calendar
inside Open WebUI. It needs a real reverse proxy for WebSockets and careful cookie/domain work; our native bubble avoids
it.

## 5. Fork and redevelop the frontend

Open WebUI is SvelteKit frontend + FastAPI backend; development runs the frontend (`:5173`) and backend (`:8080`) side by
side, and a fork builds its own image.

- Docs: [Developing Open WebUI](https://docs.openwebui.com/getting-started/advanced-topics/development/)
- License: permissive with a **branding clause** from v0.6.6; deployments with **≤50 users in 30 days** may rebrand, and
  forks must disclose that they are forks. See [Open WebUI License](https://docs.openwebui.com/license/).

**Fit for PoC2:** possible, but it duplicates a calendar Open WebUI already has, adds a build/upgrade burden, and makes
every Open WebUI release a merge. A fork is justified only if the product needs a first-class bespoke page (our Garmin
month grid with pace/HR overlays) inside the WebUI chrome, not merely "a calendar inside the product".

## Decision

1. **Mirror coach sessions into the native Open WebUI Calendar** (implemented, no fork).
2. Keep PoC2's calendar as the source of truth and the Garmin detail view.
3. If the bespoke grid must be visible in chat, add a **Rich UI tool** that embeds it; do not fork.
4. Revisit a fork only if native calendar limits (no external sync, no custom training metrics) become the product's
   core gap.

## References

- Open WebUI Calendar — https://docs.openwebui.com/features/calendar/
- Rich UI Element Embedding — https://docs.openwebui.com/features/extensibility/plugin/development/rich-ui/
- SSO / Trusted Header — https://docs.openwebui.com/features/authentication-access/auth/sso/
- Environment variables (XFRAME_OPTIONS, WEBUI_AUTH_TRUSTED_EMAIL_HEADER) — https://docs.openwebui.com/reference/env-configuration/
- HTTPS & reverse proxies — https://docs.openwebui.com/reference/https/
- Relative path issue #1162 — https://github.com/open-webui/open-webui/issues/1162
- Developing Open WebUI — https://docs.openwebui.com/getting-started/advanced-topics/development/
- License — https://docs.openwebui.com/license/
- Embeddable widget — https://github.com/taylorwilsdon/open-webui-embeddable-widget
