/**
 * PoC2 entry point: the coach gateway (OpenAI-compatible, for Open WebUI) and the private calendar, sharing one store.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createGarminClient } from "./garmin";
import { createGateway } from "./gateway";
import { createStore } from "./store";
import { createWeb } from "./web";

const gatewayPort = Number(process.env["POC2_GATEWAY_PORT"] ?? "8090");
const webPort = Number(process.env["POC2_WEB_PORT"] ?? "8091");
const databaseSpec = process.env["POC2_DB"] ?? "sqlite:data/poc2.sqlite";
const userId = process.env["POC2_USER_ID"] ?? "demo-runner";
const tokens = JSON.parse(process.env["POC2_TOKENS"] ?? '{"demo-token":"demo-runner"}') as Record<string, string>;
const garminKey = process.env["GARMIN_PERSONAL_API_KEY"];

if (databaseSpec.startsWith("sqlite:")) {
  const location = databaseSpec.slice("sqlite:".length);
  if (location !== ":memory:") mkdirSync(dirname(location), { recursive: true });
}

const handle = createStore(databaseSpec);
const garmin = garminKey === undefined || garminKey.length === 0 ? undefined : createGarminClient({ apiKey: garminKey });

const gateway = createGateway({
  store: handle.store,
  userId,
  modelBaseUrl: process.env["POC2_MODEL_BASE_URL"] ?? "http://192.168.1.202:8102/v1",
  modelApiKey: process.env["POC2_MODEL_API_KEY"] ?? "",
  modelName: process.env["POC2_MODEL_NAME"] ?? "dgx/general",
  modelId: process.env["POC2_MODEL_ID"] ?? "poc2-coach",
  calendarUrl: process.env["POC2_CALENDAR_URL"] ?? "http://127.0.0.1:8091/calendar",
});

const web = createWeb({
  store: handle.store,
  tokens,
  chatUrl: process.env["POC2_CHAT_URL"] ?? "http://127.0.0.1:3010",
  ...(garmin === undefined ? {} : { garmin }),
});

gateway.server.listen(gatewayPort, "127.0.0.1", () => {
  console.log(`poc2 gateway: listening on 127.0.0.1:${gatewayPort} (model: ${process.env["POC2_MODEL_NAME"] ?? "dgx/general"})`);
});
web.server.listen(webPort, "0.0.0.0", () => {
  console.log(`poc2 calendar: listening on 0.0.0.0:${webPort}`);
});

const shutdown = (): void => {
  handle.close();
  gateway.server.close();
  web.server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
