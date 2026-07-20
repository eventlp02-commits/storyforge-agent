import { afterEach, describe, expect, it, vi } from "vitest";
import { projectRepository } from "@/server/project-repository";

const afterState = vi.hoisted(() => ({ callback: undefined as undefined | (() => Promise<void>) }));
vi.mock("next/server", () => ({ after: (callback: () => Promise<void>) => { afterState.callback = callback; } }));

import { POST } from "./route";

const gemini = {
  modality: "llm",
  providerId: "gemini",
  protocol: "openai-compatible",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  model: "gemini-3.5-flash",
  apiKey: "gemini-key-1234567890",
  useResponses: false,
};

describe("POST /api/credentials/providers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    afterState.callback = undefined;
  });

  it("accepts a non-OpenAI LLM and defers a missing health probe to the real run", async () => {
    const created = projectRepository.createPending("一座漂浮在云层中的图书馆");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    const response = await POST(new Request("http://localhost/api/credentials/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: created.runId, providers: { llm: gemini, limits: { maxImages: 0, maxVideoSeconds: 0 } } }),
    }));
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({ backend: "local", keyAccepted: true, verification: { llm: "deferred" } });
    expect(JSON.stringify(body)).not.toContain(gemini.apiKey);
    expect(afterState.callback).toBeTypeOf("function");
  });

  it("accepts separate image and video providers without probing fal's paid queue", async () => {
    const created = projectRepository.createPending("机械花园在月光下苏醒");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const response = await POST(new Request("http://localhost/api/credentials/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: created.runId,
        providers: {
          llm: gemini,
          image: { modality: "image", providerId: "fal", protocol: "fal", baseUrl: "https://queue.fal.run", model: "fal-ai/flux/schnell", apiKey: "fal-key-1234567890" },
          video: { modality: "video", providerId: "fal", protocol: "fal", baseUrl: "https://queue.fal.run", model: "fal-ai/kling-video/v2.1/master/text-to-video", apiKey: "fal-key-1234567890" },
          limits: { maxImages: 3, maxVideoSeconds: 12 },
        },
      }),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ verification: { llm: "verified", image: "deferred", video: "deferred" } });
  });

  it("returns the provider name when an API rejects its credential", async () => {
    const created = projectRepository.createPending("一列火车驶入梦境");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const response = await POST(new Request("http://localhost/api/credentials/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: created.runId, providers: { llm: gemini } }),
    }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_api_key", provider: "gemini" });
  });

  it("explains malformed provider configuration before making a network request", async () => {
    const created = projectRepository.createPending("一艘树叶飞船穿越群星");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const response = await POST(new Request("http://localhost/api/credentials/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: created.runId,
        providers: { llm: { ...gemini, baseUrl: "http://localhost:11434/v1" } },
      }),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_provider_config",
      message: expect.stringContaining("公开 HTTPS Base URL"),
    });
    expect(request).not.toHaveBeenCalled();
  });
});
