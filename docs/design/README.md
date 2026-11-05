# Design — PoC2

## The promise

"Talk to your coach; it remembers you and turns the conversation into a training calendar."

## Primary flow

```
login (Open WebUI) → chat (one turn at a time) → coach books future sessions
                                            → reply carries the calendar link
                                            → calendar shows each day
                                            → Garmin sync completes past days
                                            → next chat starts from memory + activities
```

## Rules the design keeps

| Rule | Why |
|---|---|
| Chat is the only entry point | the owner's reframing: no wizard, no planner form |
| Memory is written by the coach, not curated by the runner | continuity without admin work |
| The calendar is private and system-owned | it is the coach's artefact, not the user's personal calendar |
| The coach writes future sessions only | the past is a fact; Garmin or a chat report completes it |
| The reply says what was booked and links the calendar | the conversation must lead somewhere visible |
| A rejected model turn changes nothing | a hallucination is visible, never silent |
| No diagnosis, no calories, clinician referral on pain | health humility in the prompt |

## Surfaces

- **Chat** (Open WebUI): threads, streaming, mobile.
- **Calendar** (PoC2 server): month grid, day detail, Garmin sync button, link back to chat.
- **No admin mode in PoC2** (non-goal).

## Open design questions

- Whether the calendar should allow manual edits (PoC2 says no).
- Whether memory should expire or be reviewable by the runner (PoC2 keeps it append-only and invisible).
- Whether a chat report of a past run should create an activity automatically (PoC2 only maps Garmin today; the coach can
  mention it, the calendar stores Garmin).
