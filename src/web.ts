/**
 * The private calendar: the artefact the conversation leaves behind. Read-only for the runner; the coach (gateway)
 * books future sessions, Garmin completes them. There is no manual edit path in PoC2 (ADR-0001).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { GarminClient } from "./garmin";
import { mapGarminActivity } from "./garmin";
import type { Activity, SessionKind, Store, TrainingSession } from "./types";

export interface WebOptions {
  store: Store;
  /** token -> userId */
  tokens: Record<string, string>;
  chatUrl?: string;
  garmin?: GarminClient;
  now?: () => string;
}

export interface WebApp {
  server: ReturnType<typeof createServer>;
  close(): Promise<void>;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendHtml(response: ServerResponse, status: number, html: string): void {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(html);
}

function redirect(response: ServerResponse, location: string, headers: Record<string, string> = {}): void {
  response.writeHead(303, { location, ...headers });
  response.end();
}

function parseCookies(request: IncomingMessage): Record<string, string> {
  const header = request.headers.cookie ?? "";
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0) cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthStart(month: string): string {
  return `${month}-01`;
}

function daysInMonth(month: string): number {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year ?? 2026, mon ?? 1, 0)).getUTCDate();
}

function weekdayIndex(day: string): number {
  return (new Date(`${day}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

function sessionChip(session: TrainingSession): string {
  const amount = session.distanceKm === null ? "" : ` · ${session.distanceKm} km`;
  return `<span class="session kind-${escapeHtml(session.kind)}" title="${escapeHtml(session.note ?? session.title)}">${escapeHtml(session.title)}${escapeHtml(amount)}</span>`;
}

function activityLine(activity: Activity): string {
  const amount = [activity.distanceKm === null ? "" : `${activity.distanceKm} km`, activity.durationMin === null ? "" : `${activity.durationMin} min`, activity.paceSecPerKm === null ? "" : `${Math.floor(activity.paceSecPerKm / 60)}:${String(activity.paceSecPerKm % 60).padStart(2, "0")}/km`, activity.avgHr === null ? "" : `${activity.avgHr} bpm`]
    .filter((part) => part.length > 0)
    .join(" · ");
  return `<li><span class="tick">✓</span> ${escapeHtml(activity.title)}${amount.length === 0 ? "" : ` — ${escapeHtml(amount)}`} <span class="muted">(${escapeHtml(activity.source)})</span></li>`;
}

function layout(title: string, body: string, chatUrl: string, signedIn: boolean): string {
  const nav = signedIn
    ? `<nav class="top"><a class="brand" href="/calendar">⚡ AI COACH CALENDAR</a><a class="chat" href="${escapeHtml(chatUrl)}">Talk to the coach →</a><a href="/logout">Sign out</a></nav>`
    : `<nav class="top"><span class="brand">⚡ AI COACH CALENDAR</span></nav>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title><link rel="stylesheet" href="/static/app.css"></head>
  <body>${nav}<main>${body}</main></body></html>`;
}

function renderLogin(error?: string): string {
  return layout(
    "Sign in",
    `<section class="card narrow"><h1>Sign in</h1>
      <p class="muted">This is the private calendar of your AI coach. The conversation happens in the chat.</p>
      ${error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(error)}</p>`}
      <form method="post" action="/login" class="stack"><label for="token">Dev token</label><input id="token" name="token" required autocomplete="off"><button class="btn" type="submit">Continue</button></form>
      <p class="muted small">Demo token: <code>demo-token</code></p>
    </section>`,
    "",
    false,
  );
}

export function createWeb(options: WebOptions): WebApp {
  const now = options.now ?? (() => new Date().toISOString());
  const chatUrl = options.chatUrl ?? "http://127.0.0.1:3010";
  const server = createServer((request, response) => {
    void (async (): Promise<void> => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const method = request.method ?? "GET";
      const cookies = parseCookies(request);
      const token = cookies["poc2"] ?? "";
      const userId = options.tokens[token];

      if (url.pathname === "/static/app.css") {
        const css = await import("./styles.ts");
        response.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" });
        response.end(css.CSS);
        return;
      }
      if (url.pathname === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }
      if (url.pathname === "/login") {
        if (method === "GET") {
          sendHtml(response, 200, renderLogin(url.searchParams.get("error") ?? undefined));
          return;
        }
        const form = await readForm(request);
        const presented = (form.get("token") ?? "").trim();
        if (options.tokens[presented] === undefined) {
          redirect(response, "/login?error=" + encodeURIComponent("unknown token"));
          return;
        }
        redirect(response, "/calendar", { "set-cookie": `poc2=${encodeURIComponent(presented)}; Path=/; HttpOnly; SameSite=Lax` });
        return;
      }
      if (url.pathname === "/logout") {
        redirect(response, "/login", { "set-cookie": "poc2=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
        return;
      }
      if (userId === undefined) {
        redirect(response, "/login");
        return;
      }
      const today = now().slice(0, 10);

      if (url.pathname === "/" || url.pathname === "/calendar") {
        const month = url.searchParams.get("month") ?? today.slice(0, 7);
        const start = monthStart(month);
        const end = addDays(start, daysInMonth(month) - 1);
        const sessions = options.store.listSessions(userId, start, end);
        const activities = options.store.listActivities(userId, 200).filter((activity) => activity.day >= start && activity.day <= end);
        const firstWeekday = weekdayIndex(start);
        const cells: string[] = [];
        for (let pad = 0; pad < firstWeekday; pad += 1) cells.push(`<div class="cell pad"></div>`);
        for (let dayNumber = 1; dayNumber <= daysInMonth(month); dayNumber += 1) {
          const day = `${month}-${String(dayNumber).padStart(2, "0")}`;
          const daySessions = sessions.filter((session) => session.day === day);
          const dayActivities = activities.filter((activity) => activity.day === day);
          cells.push(`<a class="cell${day === today ? " today" : ""}" href="/day/${escapeHtml(day)}">
            <span class="date">${dayNumber}</span>
            ${daySessions.map(sessionChip).join("")}
            ${dayActivities.length === 0 ? "" : `<span class="done">✓ ${dayActivities.length}</span>`}
          </a>`);
        }
        const prev = addDays(start, -1).slice(0, 7);
        const next = addDays(end, 1).slice(0, 7);
        const synced = url.searchParams.get("synced");
        const syncError = url.searchParams.get("syncError");
        const body = `<header class="page-head"><p class="eyebrow">Private calendar</p><h1>${MONTHS[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(0, 4)}</h1>
          <p class="muted">Sessions booked by your AI coach. Activities come from Garmin.</p></header>
          <section class="card">
            <div class="month-nav"><a href="/calendar?month=${escapeHtml(prev)}">← Previous</a><a href="/calendar?month=${escapeHtml(today.slice(0, 7))}">This month</a><a href="/calendar?month=${escapeHtml(next)}">Next →</a></div>
            ${synced === null ? "" : `<p class="ok" role="status">Garmin sync: ${escapeHtml(synced)} imported</p>`}
            ${syncError === null ? "" : `<p class="error" role="alert">Garmin sync failed: ${escapeHtml(syncError)}</p>`}
            <div class="dow">${DOW.map((day) => `<span>${day}</span>`).join("")}</div>
            <div class="month">${cells.join("")}</div>
            <form method="post" action="/sync" class="stack"><button class="btn" type="submit"${options.garmin === undefined ? " disabled" : ""}>Sync Garmin</button>${options.garmin === undefined ? `<span class="muted small">GARMIN_PERSONAL_API_KEY is not set</span>` : ""}</form>
          </section>`;
        sendHtml(response, 200, layout("Calendar", body, chatUrl, true));
        return;
      }

      if (url.pathname.startsWith("/day/")) {
        const day = url.pathname.slice("/day/".length);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
          sendHtml(response, 404, layout("Not found", `<p>Not found</p>`, chatUrl, true));
          return;
        }
        const sessions = options.store.listSessions(userId, day, day);
        const activities = options.store.listActivities(userId, 200).filter((activity) => activity.day === day);
        const body = `<header class="page-head"><p class="eyebrow"><a href="/calendar?month=${escapeHtml(day.slice(0, 7))}">← Calendar</a></p><h1>${escapeHtml(day)}</h1></header>
          <section class="card"><h2>Booked by the coach</h2>${sessions.length === 0 ? `<p class="muted">No session booked.</p>` : `<ul class="sessions">${sessions.map((session) => `<li><strong>${escapeHtml(session.title)}</strong> <span class="chip kind-${escapeHtml(session.kind)}">${escapeHtml(session.kind)}</span>${session.distanceKm === null ? "" : ` · ${session.distanceKm} km`}${session.durationMin === null ? "" : ` · ${session.durationMin} min`}${session.note === null ? "" : `<p class="note">${escapeHtml(session.note)}</p>`}</li>`).join("")}</ul>`}</section>
          <section class="card"><h2>Done (Garmin / reported)</h2>${activities.length === 0 ? `<p class="muted">Nothing recorded yet.</p>` : `<ul class="sessions">${activities.map(activityLine).join("")}</ul>`}</section>
          <p><a class="btn" href="${escapeHtml(chatUrl)}">Ask the coach about this day →</a></p>`;
        sendHtml(response, 200, layout(day, body, chatUrl, true));
        return;
      }

      if (url.pathname === "/sync" && method === "POST") {
        if (options.garmin === undefined) {
          redirect(response, "/calendar?syncError=" + encodeURIComponent("Garmin is not configured"));
          return;
        }
        try {
          const raw = await options.garmin.listActivities(30);
          let imported = 0;
          for (const item of raw) {
            const mapped = mapGarminActivity(item, userId);
            if (mapped !== undefined) {
              options.store.appendActivity(mapped);
              imported += 1;
            }
          }
          redirect(response, `/calendar?synced=${imported}`);
        } catch (error) {
          redirect(response, "/calendar?syncError=" + encodeURIComponent(error instanceof Error ? error.message : String(error)));
        }
        return;
      }

      sendHtml(response, 404, layout("Not found", `<p>Not found</p>`, chatUrl, true));
    })().catch((error: unknown) => {
      if (!response.headersSent) sendHtml(response, 500, layout("Error", `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`, chatUrl, false));
      else response.end();
    });
  });
  return { server, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

export type { SessionKind };
