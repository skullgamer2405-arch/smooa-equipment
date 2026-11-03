import { afterEach, beforeEach, expect, it, vi } from "vitest";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_DEMO_MODE", "false");
  vi.stubEnv("VITE_LINE_LIFF_ID", "fixture-liff-id");
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("remembers completed consent in a new browser session without storing an identity", async () => {
  const consent = await import("./line-consent");
  consent.saveLineChoice("accepted");
  expect(localStorage.getItem(consent.linePreferenceKey)).toBe("accepted");
  vi.stubGlobal("sessionStorage", storage());
  expect(consent.savedLineChoice()).toBe("accepted");
});

it("keeps unfinished login and dismissal within the current session only", async () => {
  const consent = await import("./line-consent");
  for (const choice of ["pending", "declined"] as const) {
    consent.saveLineChoice(choice);
    expect(consent.savedLineChoice()).toBe(choice);
    expect(localStorage.getItem(consent.linePreferenceKey)).toBeNull();
    vi.stubGlobal("sessionStorage", storage());
    expect(consent.savedLineChoice()).toBe("");
  }
});

it("rechecks legacy accepted choices instead of treating an unfinished login as consent", async () => {
  sessionStorage.setItem("smo-line-notifications-v1-live", "accepted");
  const consent = await import("./line-consent");
  expect(consent.savedLineChoice()).toBe("pending");
  expect(localStorage.getItem(consent.linePreferenceKey)).toBeNull();
  consent.saveLineChoice("accepted");
  expect(sessionStorage.getItem("smo-line-notifications-v1-live")).toBeNull();
  expect(consent.savedLineChoice()).toBe("accepted");
});

it("does not reuse demo consent or a different LIFF app's consent", async () => {
  const live = await import("./line-consent");
  live.saveLineChoice("accepted");
  vi.resetModules();
  vi.stubEnv("VITE_LINE_LIFF_ID", "another-fixture-liff-id");
  expect((await import("./line-consent")).savedLineChoice()).toBe("");
  vi.resetModules();
  vi.stubEnv("VITE_DEMO_MODE", "true");
  const demo = await import("./line-consent");
  expect(demo.savedLineChoice()).toBe("");
  demo.saveLineChoice("accepted");
  vi.resetModules();
  vi.stubEnv("VITE_DEMO_MODE", "false");
  expect((await import("./line-consent")).savedLineChoice()).toBe("");
});

it("ignores corrupt choices and falls back safely when storage is blocked", async () => {
  const consent = await import("./line-consent");
  localStorage.setItem(consent.linePreferenceKey, "unknown");
  sessionStorage.setItem(consent.linePreferenceKey, "unknown");
  expect(consent.savedLineChoice()).toBe("");
  const blocked = {
    getItem() {
      throw new DOMException("Storage blocked", "SecurityError");
    },
    setItem() {
      throw new DOMException("Storage blocked", "SecurityError");
    },
  };
  vi.stubGlobal("localStorage", blocked);
  consent.saveLineChoice("accepted");
  expect(consent.savedLineChoice()).toBe("accepted");
  vi.stubGlobal("sessionStorage", blocked);
  expect(() => consent.saveLineChoice("accepted")).not.toThrow();
  expect(consent.savedLineChoice()).toBe("");
});
