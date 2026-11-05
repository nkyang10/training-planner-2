# ADR-0001 — The LLM proposes, the server validates, the calendar is the only artefact

- **Status:** accepted (2026-11-05)
- **Context:** PoC2's interface is an LLM conversation. The coach must remember the user, build a periodic training
  system and write sessions into a private calendar, then recognise the user on return.

## Decision

1. **One structured turn.** Every coach reply is a JSON object: `reply` (language), `memories` (facts the coach chose to
   remember, append-only) and `sessions` (future training sessions to book). The server validates the shape before it
   writes anything.
2. **The server is the writer, the model is the proposer.** A session is written only if its day is today or later, its
   kind is known, its distance/duration are inside sane bounds, and the user owns it. A malformed answer writes nothing
   and the user sees the error, not a silent change.
3. **Memory is append-only and per user.** The coach writes memories without asking the user to curate them. Memories are
   never rewritten; a wrong memory is superseded by a newer one in the prompt order.
4. **The calendar is private and system-owned.** It is not the user's personal calendar. The coach books future sessions;
   Garmin (or a chat report) adds completed activities; the past is append-only.
5. **The coach is the only writer of planned sessions.** No manual edit UI in PoC2. Re-planning replaces future sessions
   only, never a past day.
6. **Health humility.** The prompt forbids diagnosis, calorie/weight prescriptions and guarantees; pain or medical topics
   end with a clinician referral. Load changes are allowed, treatment is not.

## Consequences

- The conversation can wander, but every write is bounded and auditable in SQLite.
- The coach can be swapped (model or prompt) without changing the calendar contract.
- A model hallucination is visible as a rejected turn, not as a corrupted calendar.
