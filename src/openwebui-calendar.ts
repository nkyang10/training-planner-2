/**
 * Mirror the coach's planned sessions into Open WebUI's native Calendar.
 *
 * Open WebUI already ships a month/week/day calendar with reminders. Rather than forking its frontend or iframing it,
 * PoC2 writes each booked session as an all-day event on the user's default calendar through the documented API
 * (`/api/v1/calendars/...`). The coach stays the source of truth; the native calendar is a view of it.
 */
export interface OpenWebUiCalendarOptions {
  baseUrl: string;
  email: string;
  password: string;
  /** Local offset used for all-day events, e.g. "+08:00". Defaults to the server's offset. */
  timezoneOffset?: string;
  fetchImpl?: typeof fetch;
}

export interface CalendarEventDraft {
  sessionId: string;
  day: string;
  title: string;
  description: string;
  kind: string;
}

export interface CalendarMirrorResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface CalendarMirror {
  ensureEvents(events: readonly CalendarEventDraft[]): Promise<CalendarMirrorResult>;
}

export class OpenWebUiCalendarError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OpenWebUiCalendarError";
  }
}

interface CalendarRecord {
  id: string;
  name: string;
  is_default?: boolean;
}

interface EventRecord {
  id: string;
  meta?: Record<string, unknown> | null;
}

const TOKEN_TTL_MS = 50 * 60 * 1000;

function localMidnightNs(day: string, offset: string): number {
  const millis = Date.parse(`${day}T00:00:00${offset}`);
  if (Number.isNaN(millis)) throw new OpenWebUiCalendarError(`invalid day: ${day}`, 0);
  return millis * 1_000_000;
}

export function createOpenWebUiCalendar(options: OpenWebUiCalendarOptions): CalendarMirror {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const offset = options.timezoneOffset ?? "+08:00";
  let token = "";
  let tokenAt = 0;
  let calendarId: string | undefined;

  const request = async (path: string, init: RequestInit = {}, retry = true): Promise<Response> => {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(token.length === 0 ? {} : { authorization: `Bearer ${token}` }),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
    });
    if (response.status === 401 && retry) {
      token = "";
      await signIn();
      return request(path, init, false);
    }
    return response;
  };

  const signIn = async (): Promise<void> => {
    const response = await fetchImpl(`${baseUrl}/api/v1/auths/signin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: options.email, password: options.password }),
    });
    if (!response.ok) throw new OpenWebUiCalendarError(`Open WebUI sign-in answered ${response.status}`, response.status);
    const body = (await response.json()) as { token?: unknown };
    if (typeof body.token !== "string" || body.token.length === 0) {
      throw new OpenWebUiCalendarError("Open WebUI sign-in returned no token", response.status);
    }
    token = body.token;
    tokenAt = Date.now();
  };

  const ensureToken = async (): Promise<void> => {
    if (token.length === 0 || Date.now() - tokenAt > TOKEN_TTL_MS) await signIn();
  };

  const ensureCalendar = async (): Promise<string> => {
    if (calendarId !== undefined) return calendarId;
    const response = await request("/api/v1/calendars/");
    if (!response.ok) throw new OpenWebUiCalendarError(`Open WebUI calendars answered ${response.status}`, response.status);
    const calendars = (await response.json()) as CalendarRecord[];
    const chosen = calendars.find((calendar) => calendar.is_default === true) ?? calendars[0];
    if (chosen === undefined) throw new OpenWebUiCalendarError("Open WebUI has no calendar", 404);
    calendarId = chosen.id;
    return calendarId;
  };

  const listEvents = async (fromDay: string, toDay: string): Promise<EventRecord[]> => {
    const response = await request(
      `/api/v1/calendars/events?start=${encodeURIComponent(`${fromDay}T00:00:00`)}&end=${encodeURIComponent(`${toDay}T23:59:59`)}`,
    );
    if (!response.ok) throw new OpenWebUiCalendarError(`Open WebUI events answered ${response.status}`, response.status);
    return (await response.json()) as EventRecord[];
  };

  return {
    async ensureEvents(events: readonly CalendarEventDraft[]): Promise<CalendarMirrorResult> {
      if (events.length === 0) return { created: 0, updated: 0, skipped: 0 };
      await ensureToken();
      const calendar = await ensureCalendar();
      const days = events.map((event) => event.day).sort();
      const first = days[0] ?? "";
      const last = days[days.length - 1] ?? "";
      const existing = await listEvents(first, last);
      const bySession = new Map<string, string>();
      for (const event of existing) {
        const sessionId = event.meta?.["poc2_session_id"];
        if (typeof sessionId === "string") bySession.set(sessionId, event.id);
      }
      let created = 0;
      let updated = 0;
      let skipped = 0;
      for (const event of events) {
        const start = localMidnightNs(event.day, offset);
        const payload = {
          calendar_id: calendar,
          title: event.title,
          description: event.description,
          start_at: start,
          end_at: start + 86_400_000_000_000,
          all_day: true,
          meta: { source: "poc2-coach", poc2_session_id: event.sessionId, kind: event.kind },
        };
        const existingId = bySession.get(event.sessionId);
        if (existingId === undefined) {
          const response = await request("/api/v1/calendars/events/create", { method: "POST", body: JSON.stringify(payload) });
          if (!response.ok) throw new OpenWebUiCalendarError(`Open WebUI create answered ${response.status}`, response.status);
          created += 1;
        } else {
          const response = await request(`/api/v1/calendars/events/${encodeURIComponent(existingId)}/update`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new OpenWebUiCalendarError(`Open WebUI update answered ${response.status}`, response.status);
          updated += 1;
        }
      }
      skipped += events.length - created - updated;
      return { created, updated, skipped };
    },
  };
}
