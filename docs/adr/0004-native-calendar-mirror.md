# ADR-0004 — Mirror sessions into Open WebUI's native Calendar instead of forking or iframing

- **Status:** accepted (2026-11-06)
- **Context:** the runner wants the training calendar to be part of the chat product. Open WebUI already ships a
  personal calendar with month/week/day views, reminders and an events API.

## Decision

1. **No fork, no iframe.** Open WebUI stays the upstream chat product; PoC2 does not redevelop its SvelteKit frontend.
2. **The coach's sessions are mirrored into the native Calendar.** After a validated turn books sessions, the gateway
   signs in as the owner, finds the default calendar, and creates or updates one all-day event per session through
   `/api/v1/calendars/events/...`.
3. **PoC2's SQLite remains the source of truth.** The native calendar is a view. If the mirror fails, the booking is still
   in PoC2's store and the chat reply is unaffected.
4. **Dedupe by `meta.poc2_session_id`.** Re-planning updates the same event instead of duplicating it.
5. **The bespoke Garmin month grid stays on `:8091`.** If it must appear inside chat later, it is a Rich UI embed (a
   tool returning an inline `HTMLResponse`), not a frontend fork.
6. **A fork is revisited only if the native calendar's limits become the product's core gap.** The licence's branding
   clause and the upgrade/merge burden make a fork a last resort.

## Consequences

- The runner opens Open WebUI's sidebar → Calendar and sees training days, with reminders.
- No double login, no sandboxed iframe, no reverse proxy for WebSockets.
- The native calendar does not sync external calendars (documented limitation); Garmin detail remains in PoC2.
- Two calendars exist by design: the native schedule view and PoC2's source-of-truth/Garmin view.
