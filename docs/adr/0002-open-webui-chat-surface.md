# ADR-0002 — Open WebUI is the chat surface; the coach gateway is the model

- **Status:** accepted (2026-11-05)
- **Context:** the owner accepts using an existing chat product instead of building chat from scratch. The first job is a
  working conversation; the second is guiding the coach to write into the private calendar.

## Decision

1. **Open WebUI is the chat product.** It is used as a container, unforked: login, threads, streaming, mobile layout and
   message rendering are Open WebUI's.
2. **PoC2 is an OpenAI-compatible model behind it.** The gateway exposes `GET /v1/models` and
   `POST /v1/chat/completions`; Open WebUI registers it as `poc2-coach`.
3. **The gateway owns the coach contract.** It injects memories, upcoming sessions and Garmin activities into the model
   prompt, parses the structured turn, validates it, writes memories/sessions, and returns only the natural-language
   reply to the chat.
4. **No Open WebUI plugin is required.** Functions/pipelines would tie PoC2 to Open WebUI's internal API; the model
   boundary is stable and swappable.
5. **The calendar is a separate PoC2 surface.** The chat reply carries a calendar link when sessions are booked.

## Consequences

- Chat quality, streaming and mobile behaviour are Open WebUI's, not ours.
- The coach contract is testable without a browser: `POST /v1/chat/completions` is the seam.
- Open WebUI's own chat history is not PoC2 memory; deleting a chat does not delete memories or sessions.
- A different chat front-end can replace Open WebUI by pointing at the same gateway.
