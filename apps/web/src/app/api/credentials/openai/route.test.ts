import { afterEach, describe, expect, it, vi } from "vitest";
import { projectRepository } from "@/server/project-repository";

const afterState = vi.hoisted(() => ({ callback: undefined as undefined | (() => Promise<void>) }));
vi.mock("next/server", () => ({ after: (callback: () => Promise<void>) => { afterState.callback = callback; } }));

import { POST } from "./route";

describe("POST /api/credentials/openai", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    afterState.callback = undefined;
  });

  it("accepts a validated key for a local run without authentication", async () => {
    const created = projectRepository.createPending("一个影子剧团追赶被风吹走的舞台");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const response = await POST(new Request("http://localhost/api/credentials/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: created.runId, apiKey: "test-key-12345678901234567890" }),
    }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ backend: "local", keyAccepted: true });
    expect(afterState.callback).toBeTypeOf("function");
  });

  it("returns a clear response when OpenAI rejects the key", async () => {
    const created = projectRepository.createPending("一名风筝匠修补破碎的天空");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const response = await POST(new Request("http://localhost/api/credentials/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: created.runId, apiKey: "test-key-12345678901234567890" }),
    }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid_api_key", message: "OpenAI 拒绝了这个 API Key，请检查后重试。" });
  });
});
