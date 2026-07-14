import { describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "@/lib/format";

describe("format helpers", () => {
  it("formats relative time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T12:00:00Z"));
    expect(formatRelativeTime(new Date("2026-06-15T12:00:00Z"))).toBe("yesterday");
    vi.useRealTimers();
  });
});
