/**
 * The PoC2 coach gateway: an OpenAI-compatible endpoint that Open WebUI can talk to as a "model".
 *
 * Open WebUI stays the chat product. This gateway is where the coach gets memory and a calendar: it loads the runner's
 * memories, upcoming sessions and Garmin activities, asks the local model for one structured turn, validates it, writes
 * the memories/sessions, and returns only the natural-language reply to the chat.
 */
import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildCoachHistory, buildCoachPrompt, parseCoachTurn } from "./coach";
import type { Message, Store } from "./types";

export interface GatewayOptions {
  store: Store;
  /** The single PoC runner; multi-user routing comes later. */
  userId: string;
  modelBaseUrl: string;
  modelApiKey: string;
  modelName: string;
  modelId?: string;
  /** Where the runner opens the calendar the coach writes into. */
  calendarUrl?: string;
  now?: () => string;
  fetchImpl?: typeof fetch;
}

export interface Gateway {
  server: ReturnType<typeof createServer>;
  close(): Promise<void>;
}

const FALLBACK_REPLY =
  "I could not safely write that turn, so nothing was changed. Please say it again in a simpler way — for example the goal, the days you can train, and anything that hurts.";

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  response.end(payload);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > 2_000_000) throw new Error("request too large");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text.length === 0 ? undefined : (JSON.parse(text) as unknown);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lastUserText(body: Record<string, unknown>): string {
  const messages = Array.isArray(body["messages"]) ? body["messages"] : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (isObject(message) && message["role"] === "user" && typeof message["content"] === "string") {
      return message["content"].trim();
    }
  }
  return "";
}

/** The model may wrap JSON in a fence; take the outermost object. */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the model answer");
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

async function askModel(
  options: GatewayOptions,
  prompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  question: string,
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetchImpl(`${options.modelBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${options.modelApiKey}` },
      body: JSON.stringify({
        model: options.modelName,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: prompt }, ...history, { role: "user", content: question }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`model answered ${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("model returned no content");
    return extractJson(content);
  } finally {
    clearTimeout(timer);
  }
}

function completionBody(id: string, model: string, reply: string, created: number, meta: { sessions: number; memories: number }): unknown {
  return {
    id,
    object: "chat.completion",
    created,
    model,
    choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    poc2: meta,
  };
}

function streamChunk(id: string, model: string, created: number, content: string, finish: string | null): string {
  return `data: ${JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta: content.length === 0 ? {} : { content }, finish_reason: finish }],
  })}\n\n`;
}

export function createGateway(options: GatewayOptions): Gateway {
  const now = options.now ?? (() => new Date().toISOString());
  const modelId = options.modelId ?? "poc2-coach";
  const server = createServer((request, response) => {
    void (async (): Promise<void> => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const method = request.method ?? "GET";
      if (method === "OPTIONS") {
        response.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, content-type, x-poc2-user",
          "access-control-allow-methods": "GET, POST, OPTIONS",
        });
        response.end();
        return;
      }
      if (url.pathname === "/health" && method === "GET") {
        sendJson(response, 200, { status: "ok", model: options.modelName });
        return;
      }
      if (url.pathname === "/v1/models" && method === "GET") {
        sendJson(response, 200, {
          object: "list",
          data: [{ id: modelId, object: "model", created: Math.floor(Date.now() / 1000), owned_by: "poc2" }],
        });
        return;
      }
      if (url.pathname !== "/v1/chat/completions" || method !== "POST") {
        sendJson(response, 404, { error: { code: "not-found", detail: "use POST /v1/chat/completions" } });
        return;
      }

      let body: unknown;
      try {
        body = await readJson(request);
      } catch (error) {
        sendJson(response, 400, { error: { code: "invalid-body", detail: error instanceof Error ? error.message : String(error) } });
        return;
      }
      if (!isObject(body)) {
        sendJson(response, 400, { error: { code: "invalid-body", detail: "expected a JSON object" } });
        return;
      }
      const question = lastUserText(body);
      if (question.length === 0) {
        sendJson(response, 400, { error: { code: "no-question", detail: "the last user message is empty" } });
        return;
      }
      const userId = typeof request.headers["x-poc2-user"] === "string" ? request.headers["x-poc2-user"] : options.userId;
      const today = now().slice(0, 10);
      const history = options.store.listMessages(userId, 20);
      const prompt = buildCoachPrompt({
        today,
        memories: options.store.listMemories(userId, 100),
        sessions: options.store.listSessions(userId, today, addDays(today, 56)),
        activities: options.store.listActivities(userId, 10),
        history,
        question,
      });
      const createdAt = now();
      options.store.appendMessage({
        messageId: randomUUID(),
        userId,
        role: "user",
        text: question,
        createdAt,
      });

      let raw: unknown;
      try {
        raw = await askModel(options, prompt, buildCoachHistory({ today, memories: [], sessions: [], activities: [], history, question }), question);
      } catch (error) {
        sendJson(response, 502, { error: { code: "model-failed", detail: error instanceof Error ? error.message : String(error) } });
        return;
      }
      const parsed = parseCoachTurn(raw, today);
      let reply = FALLBACK_REPLY;
      let bookedSessions = 0;
      let remembered = 0;
      if (parsed.ok) {
        reply = parsed.turn.reply;
        if (parsed.turn.sessions.length > 0 && options.calendarUrl !== undefined) {
          reply = `${reply}\n\nYour calendar: ${options.calendarUrl}`;
        }
        for (const text of parsed.turn.memories) {
          options.store.appendMemory({ memoryId: randomUUID(), userId, text, createdAt: now() });
        }
        remembered = parsed.turn.memories.length;
        bookedSessions = parsed.turn.sessions.length;
        for (const draft of parsed.turn.sessions) {
          options.store.upsertSession({
            // Same day + kind + title is the same booking across turns: re-planning replaces it instead of duplicating.
            sessionId: `session:${createHash("sha256").update(`${userId}:${draft.day}:${draft.kind}:${draft.title}`).digest("hex").slice(0, 32)}`,
            userId,
            day: draft.day,
            title: draft.title,
            kind: draft.kind,
            distanceKm: draft.distanceKm,
            durationMin: draft.durationMin,
            note: draft.note,
            createdAt: now(),
          });
        }
      }
      options.store.appendMessage({ messageId: randomUUID(), userId, role: "assistant", text: reply, createdAt: now() });

      const id = `chatcmpl-${randomUUID()}`;
      const created = Math.floor(Date.now() / 1000);
      if (body["stream"] === true) {
        response.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        });
        response.write(streamChunk(id, modelId, created, reply, null));
        response.write(streamChunk(id, modelId, created, "", "stop"));
        response.write("data: [DONE]\n\n");
        response.end();
        return;
      }
      sendJson(response, 200, completionBody(id, modelId, reply, created, { sessions: bookedSessions, memories: remembered }));
    })().catch((error: unknown) => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: { code: "gateway-failed", detail: error instanceof Error ? error.message : String(error) } });
      } else {
        response.end();
      }
    });
  });
  return {
    server,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
