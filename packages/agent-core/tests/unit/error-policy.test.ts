import { describe, expect, it } from "vitest";
import { classifyProviderError, retryPolicyFor } from "../../src/error-policy";

describe("provider error policy", () => {
  it("retries rate limits three times with exponential backoff", () => {
    expect(classifyProviderError({ status: 429, message: "rate limit" })).toBe("rate-limit");
    expect(retryPolicyFor("rate-limit")).toEqual({ maxRetries: 3, delaysMs: [500, 1000, 2000] });
  });

  it("repairs malformed structure once and never retries refusals or invalid credentials", () => {
    expect(retryPolicyFor("structured-output").maxRetries).toBe(1);
    expect(retryPolicyFor("refusal").maxRetries).toBe(0);
    expect(retryPolicyFor("authentication").maxRetries).toBe(0);
  });
});
