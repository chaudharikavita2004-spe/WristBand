import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Safety data hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("keeps demo history fixed even when the module loads at different times", async () => {
    const first = await import("@/lib/store");
    const timestamp = first.useApp.getState().journeys[0]?.startedAt;
    expect(timestamp).toBe(Date.parse("2026-10-28T00:20:00Z"));
    vi.resetModules();
    const later = await import("@/lib/store");
    expect(later.useApp.getState().journeys[0]?.startedAt).toBe(timestamp);
  });

  it("withholds date formatting until saved data is hydrated", async () => {
    const { useApp, fmt } = await import("@/lib/store");
    const timestamp = Date.parse("2026-10-27T12:00:00Z");
    expect(fmt(timestamp)).toBe("—");
    await useApp.persist.rehydrate();
    expect(fmt(timestamp)).toBe(new Date(timestamp).toLocaleString());
    expect(fmt(null)).toBe("—");
    expect(fmt(Number.NaN)).toBe("—");
    expect(fmt(1e20)).toBe("—");
  });

  it("only marks content ready after restoring saved journey and countdown dates", async () => {
    const { useApp, useAppHydrated } = await import("@/lib/store");
    const saved = useApp.getState();
    const startedAt = Date.parse("2026-10-28T03:00:00Z");
    const nextDue = Date.parse("2026-10-28T04:00:00Z");
    localStorage.setItem("wristband-v1", JSON.stringify({ state: {
      ...saved,
      journeys: [{ ...saved.journeys[0], startedAt, status: "active" }],
      shield: { ...saved.shield, active: true, nextDue },
    }, version: 0 }));
    const { result } = renderHook(() => useAppHydrated());
    expect(result.current).toBe(false);
    await act(async () => { await useApp.persist.rehydrate(); });
    await waitFor(() => expect(result.current).toBe(true));
    expect(useApp.getState().journeys[0]?.startedAt).toBe(startedAt);
    expect(useApp.getState().shield.nextDue).toBe(nextDue);
  });
});