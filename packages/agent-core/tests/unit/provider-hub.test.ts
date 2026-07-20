import { describe, expect, it, vi } from "vitest";
import {
  getProviderPreset,
  listProviderPresets,
  providerBundleSchema,
  sanitizeProviderBundle,
  validateProviderConnection,
} from "../../src/provider-hub";

describe("provider hub", () => {
  it("exposes broad LLM, image, and video provider presets", () => {
    expect(listProviderPresets("llm").map((preset) => preset.id)).toEqual(expect.arrayContaining([
      "openai",
      "anthropic",
      "gemini",
      "deepseek",
      "qwen",
      "kimi",
      "groq",
      "mistral",
      "xai",
      "openrouter",
      "together",
      "siliconflow",
      "custom",
    ]));
    expect(listProviderPresets("image").map((preset) => preset.id)).toEqual(expect.arrayContaining(["openai", "replicate", "fal", "runway", "custom"]));
    expect(listProviderPresets("video").map((preset) => preset.id)).toEqual(expect.arrayContaining(["openai", "replicate", "fal", "runway", "custom"]));
  });

  it("normalizes a provider bundle and strips secrets before persistence", () => {
    const bundle = providerBundleSchema.parse({
      llm: {
        modality: "llm",
        providerId: "gemini",
        protocol: "openai-compatible",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
        model: "gemini-3.5-flash",
        apiKey: "gemini-secret-key",
        useResponses: false,
      },
      image: {
        modality: "image",
        providerId: "fal",
        protocol: "fal",
        baseUrl: "https://queue.fal.run/",
        model: "fal-ai/flux/schnell",
        apiKey: "fal-secret-key",
      },
      limits: { maxImages: 4, maxVideoSeconds: 0 },
    });
    expect(bundle.llm.baseUrl).toBe("https://generativelanguage.googleapis.com/v1beta/openai");
    const sanitized = sanitizeProviderBundle(bundle);
    expect(JSON.stringify(sanitized)).not.toContain("secret-key");
    expect(sanitized).toMatchObject({
      llm: { providerId: "gemini", model: "gemini-3.5-flash" },
      image: { providerId: "fal", model: "fal-ai/flux/schnell" },
      limits: { maxImages: 4, maxVideoSeconds: 0 },
    });
  });

  it("rejects insecure or private custom endpoints", () => {
    const input = {
      modality: "llm",
      providerId: "custom",
      protocol: "openai-compatible",
      model: "local-model",
      apiKey: "local-secret-key",
    };
    expect(providerBundleSchema.safeParse({ llm: { ...input, baseUrl: "http://example.com/v1" } }).success).toBe(false);
    expect(providerBundleSchema.safeParse({ llm: { ...input, baseUrl: "https://127.0.0.1:11434/v1" } }).success).toBe(false);
    expect(providerBundleSchema.safeParse({ llm: { ...input, baseUrl: "https://192.168.1.8/v1" } }).success).toBe(false);
    expect(providerBundleSchema.safeParse({ llm: { ...input, baseUrl: "https://[::1]/v1" } }).success).toBe(false);
    expect(providerBundleSchema.safeParse({ llm: { ...input, baseUrl: "https://[fd00::1]/v1" } }).success).toBe(false);
  });

  it("verifies compatible credentials without blocking runs on unsupported health probes", async () => {
    const preset = getProviderPreset("llm", "deepseek");
    const connection = providerBundleSchema.parse({
      llm: { ...preset, modality: "llm", providerId: preset.id, apiKey: "deepseek-secret-key" },
    }).llm;
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(validateProviderConnection(connection, request)).resolves.toEqual({ valid: true, verification: "deferred" });
    expect(request).toHaveBeenCalledWith("https://api.deepseek.com/models", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ authorization: "Bearer deepseek-secret-key" }),
    }));
  });

  it("uses Anthropic headers and rejects credentials only on explicit auth failures", async () => {
    const preset = getProviderPreset("llm", "anthropic");
    const connection = providerBundleSchema.parse({
      llm: { ...preset, modality: "llm", providerId: preset.id, apiKey: "anthropic-secret-key" },
    }).llm;
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(validateProviderConnection(connection, request)).resolves.toEqual({ valid: false, reason: "invalid_api_key" });
    expect(request).toHaveBeenCalledWith("https://api.anthropic.com/v1/models", expect.objectContaining({
      headers: expect.objectContaining({ "x-api-key": "anthropic-secret-key", "anthropic-version": "2023-06-01" }),
    }));
  });

  it("does not mistake a corporate proxy or permission-level 403 for an invalid key", async () => {
    const preset = getProviderPreset("llm", "openai");
    const connection = providerBundleSchema.parse({
      llm: { ...preset, modality: "llm", providerId: preset.id, apiKey: "openai-secret-key" },
    }).llm;
    const request = vi.fn().mockResolvedValue(new Response("blocked by upstream policy", { status: 403 }));
    await expect(validateProviderConnection(connection, request)).resolves.toEqual({ valid: true, verification: "deferred" });
  });
});
