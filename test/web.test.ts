import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "../src/store";
import { createWeb } from "../src/web";
import type { GarminClient } from "../src/garmin";

const USER = "demo-runner";
const TODAY = "2026-11-05";

const start = async (garmin?: GarminClient) => {
  const handle = createStore(":memory:");
  handle.store.upsertSession({
    sessionId: "s1",
    userId: USER,
    day: "2026-11-06",
    title: "Easy 5 km",
    kind: "easy",
    distanceKm: 5,
    durationMin: 35,
    note: "conversational",
    createdAt: `${TODAY}T00:00:00.000Z`,
  });
  const web = createWeb({
    store: handle.store,
    tokens: { "demo-token": USER },
    chatUrl: "http://chat.test",
    now: () => `${TODAY}T08:00:00.000Z`,
    ...(garmin === undefined ? {} : { garmin }),
  });
  await new Promise<void>((resolve) => web.server.listen(0, "127.0.0.1", resolve));
  const address = web.server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { handle, web, base: `http://127.0.0.1:${port}` };
};

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

describe("private calendar", () => {
  it("requires a token and then shows the month", async () => {
    const { handle, web, base } = await start();
    cleanup = async () => {
      await web.close();
      handle.close();
    };
    const denied = await fetch(`${base}/calendar`, { redirect: "manual" });
    expect(denied.status).toBe(303);
    expect(denied.headers.get("location")).toBe("/login");

    const login = await fetch(`${base}/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "token=demo-token",
      redirect: "manual",
    });
    expect(login.status).toBe(303);
    expect(login.headers.get("location")).toBe("/calendar");
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

    const page = await fetch(`${base}/calendar?month=2026-11`, { headers: { cookie } });
    const html = await page.text();
    expect(html).toContain("Easy 5 km");
    expect(html).toContain("November 2026");
  });

  it("shows a day with the booked session and a chat link", async () => {
    const { handle, web, base } = await start();
    cleanup = async () => {
      await web.close();
      handle.close();
    };
    const page = await fetch(`${base}/day/2026-11-06`, { headers: { cookie: "poc2=demo-token" } });
    const html = await page.text();
    expect(html).toContain("Easy 5 km");
    expect(html).toContain("http://chat.test");
  });

  it("syncs Garmin activities into the calendar", async () => {
    const garmin: GarminClient = {
      async token() {
        return "t";
      },
      async listActivities() {
        return [
          {
            activityId: 900001,
            activityName: "Morning run",
            startTimeLocal: "2026-11-04 07:00:00",
            distance: 4200,
            duration: 1680,
            averageSpeed: 2.5,
            averageHR: 150,
          },
        ];
      },
    };
    const { handle, web, base } = await start(garmin);
    cleanup = async () => {
      await web.close();
      handle.close();
    };
    const response = await fetch(`${base}/sync`, { method: "POST", headers: { cookie: "poc2=demo-token" }, redirect: "manual" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/calendar?synced=1");
    expect(handle.store.listActivities(USER)).toHaveLength(1);
  });
});
