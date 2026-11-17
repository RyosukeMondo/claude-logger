import { describe, it, expect } from "vitest";
import { extractTokenUsage, calculateCost } from "@/lib/costs";
import type { HookEvent } from "@/lib/types";

describe("extractTokenUsage", () => {
  it("extracts from top-level usage field", () => {
    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "Stop",
      usage: { input_tokens: 1000, output_tokens: 500 },
    };
    expect(extractTokenUsage(event)).toEqual({
      input_tokens: 1000,
      output_tokens: 500,
    });
  });

  it("extracts from result.usage", () => {
    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "Stop",
      result: { usage: { input_tokens: 2000, output_tokens: 800 } },
    };
    expect(extractTokenUsage(event)).toEqual({
      input_tokens: 2000,
      output_tokens: 800,
    });
  });

  it("returns zeros when no usage data", () => {
    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "Stop",
    };
    expect(extractTokenUsage(event)).toEqual({
      input_tokens: 0,
      output_tokens: 0,
    });
  });

  it("handles partial usage data", () => {
    const event: HookEvent = {
      session_id: "s1",
      hook_event_name: "Stop",
      usage: { input_tokens: 1000 },
    };
    expect(extractTokenUsage(event)).toEqual({
      input_tokens: 1000,
      output_tokens: 0,
    });
  });
});

describe("calculateCost", () => {
  it("calculates with default pricing", () => {
    const cost = calculateCost(1_000_000, 1_000_000);
    // Default: $3/M input + $15/M output = $18
    expect(cost).toBe(18);
  });

  it("returns 0 for zero tokens", () => {
    expect(calculateCost(0, 0)).toBe(0);
  });

  it("uses model-specific pricing when available", () => {
    const cost = calculateCost(1_000_000, 1_000_000, "claude-opus-4-20250514");
    // Opus: $15/M input + $75/M output = $90
    expect(cost).toBe(90);
  });

  it("falls back to default for unknown model", () => {
    const cost = calculateCost(1_000_000, 0, "unknown-model");
    expect(cost).toBe(3); // default input rate
  });
});
