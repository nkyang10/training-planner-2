# PoC2 brief — the conversation *is* the product

Source: owner's brief, 2026-11-05. This is the single source of truth for PoC2.

## 1. Problem

PoC1 asked the runner to operate a planner UI. PoC2 flips it: after login the runner lands in a normal AI-chat surface
and simply talks to the AI coach. The coach is the only interface; the calendar is the artefact the conversation leaves
behind.

## 2. Approach

- **Chat-first, turn by turn.** After login the user is in a chat like a general AI site: the user says one thing, the
  coach answers one thing. There is no setup wizard and no planner form to fill in.
- **The coach remembers proactively.** During the conversation the coach notes facts about the user on its own —
  training-relevant facts, but also whatever helps it understand the user. The user does not curate, tag or approve
  memories. The memory is what makes the next conversation feel continuous.
- **Conversation may wander.** Chit-chat and unrelated topics are allowed. The coach's job is to notice when the user
  says something training-related and then proactively build a training system for them.
- **The training system is periodic.** It is a block of future days tailored to the user's needs, laid out from what the
  coach knows about the user at that moment.
- **The core act is booking sessions into a private calendar.** The system owns an independent calendar for the user —
  not the user's own calendar. The coach writes future training sessions straight into it; the user opens the calendar
  and sees what to do each day.
- **The calendar also holds history.** It stores activities recorded by the user's Garmin watch, and past activities the
  user reports in chat. Garmin is the first watch integration.
- **After a session, the system pulls the activity back from Garmin.** Completed activities land in the calendar and
  become facts for the next conversation.
- **Returning users are recognised.** When the user comes back and talks, the coach proactively mentions the training it
  remembers and offers suggestions or modifications to the coming days.
- **The whole system is a user ↔ AI-coach conversation system.** The coach is not a human; it is fully automatic and
  LLM-driven. The result of the conversation is a calendar/month/date system.

## 3. Users and jobs

| User | Job |
|---|---|
| A runner with a Garmin watch | log in, talk, receive a training calendar, do the sessions, see them tick off after Garmin sync |
| A runner without a watch (first PoC) | talk, receive a calendar, report sessions in chat; Garmin sync is optional |

## 4. Constraints

- **LLM-driven coach**, not a scripted bot: the reply, the memories and the proposed sessions come from the model.
- **The system validates before writing.** A model answer cannot write an invalid date, a past day, or an absurd
  session; the server checks and only then writes to the calendar.
- **Per-user isolation.** Every message, memory, session and activity belongs to one user.
- **Private calendar.** The calendar is the system's own; it is not Google/Apple calendar and does not read the user's
  personal calendar.
- **Garmin first**, using the Garmin Personal API key; no Strava in PoC2.
- **Health humility.** No diagnosis, no calorie/weight prescriptions; pain or medical topics end with a clinician
  referral. The coach may adjust load but never prescribes treatment.
- **Mobile-first chat.** The owner reads it on a phone.

## 5. Success criteria

1. Log in with a dev token and land directly in the chat — no wizard.
2. Say "I want to train for a 10k in 8 weeks" (or similar); the coach replies, remembers facts, and books future
   sessions into the private calendar.
3. Open the calendar: the booked sessions are visible on their days, and past days are never rewritten.
4. Sync Garmin: completed activities appear in the calendar and are visible to the coach in the next turn.
5. Return later: the coach's first reply references remembered training without the user repeating it.
6. The conversation can be ordinary chit-chat; when training comes up, the coach shifts to building the system.
7. Every write is validated; a malformed model answer changes nothing.

## 6. Non-goals

- No human coach, no admin console in PoC2.
- No Strava, no Apple Health, no Google Calendar.
- No payments, no social features, no multi-language beyond English + Traditional Chinese copy where practical.
- No claim of medical safety; the coach is a training assistant, not a clinician.

## 7. Open questions (answered by the owner if needed)

- Which Garmin fields matter first: distance, duration, pace, heart rate? (PoC2 takes distance + duration + pace/HR when
  present.)
- Should the calendar allow manual edits? (PoC2: no manual edit of coach-booked sessions; the coach is the only writer,
  Garmin is the only completer.)

## 8. Decision log

- ADR-0001: the LLM proposes, the server validates and writes; memory is append-only.
