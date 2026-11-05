# ADR-0003 — The in-calendar chat is a same-origin bubble on the gateway, not an iframe of Open WebUI

- **Status:** accepted (2026-11-06)
- **Context:** the owner asked to integrate the chat into the calendar web: talk to the coach from the calendar, with a
  chat bubble like Open WebUI's.

## Decision

1. **The calendar page embeds a native chat bubble.** A floating button opens a panel with message bubbles, a textarea and
   a send action. It is rendered by PoC2, not by an iframe.
2. **The bubble talks through the calendar origin.** `POST /chat` on the calendar server proxies to the coach gateway with
   the runner's session and user id. The browser never calls the gateway directly.
3. **The bubble is the same coach.** Same model `poc2-coach`, same memories, same validated session writes, same calendar
   link. A turn from the bubble and a turn from Open WebUI are indistinguishable to the coach.
4. **Open WebUI stays the full chat surface.** The top bar keeps a "Full chat ↗" link for long conversations, streaming,
   threads and mobile chat.
5. **No iframe.** Embedding Open WebUI would duplicate its login inside the bubble, inherit its full layout and make the
   calendar depend on Open WebUI's framing policy; the gateway boundary is smaller and testable.

## Consequences

- The runner can book a session while looking at the calendar, without leaving the page.
- The bubble shows "Calendar updated — refresh" when the coach booked sessions; a full page refresh shows them.
- Two chat surfaces exist by design: the bubble for quick in-context turns, Open WebUI for long conversations.
- The bubble is non-streaming in PoC2; streaming is an Open WebUI-only capability today.
