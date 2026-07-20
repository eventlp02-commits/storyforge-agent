import { describe, expect, it, vi } from "vitest";
import { AnthropicStageExecutor, OpenAICompatibleStageExecutor, createStageExecutor } from "../../src/stage-executors";
import { providerBundleSchema } from "../../src/provider-hub";

const intake = {
  title: "倒流之城",
  format: "narrative-short",
  durationSeconds: 60,
  aspectRatio: "16:9",
  contentLanguage: "zh-CN",
  audience: "大众",
  goal: "讲述时间倒流的秘密",
  assumptions: ["默认 60 秒"],
};

describe("stage executors", () => {
  it("runs Anthropic's native Messages API and validates structured output", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({
      content: [{ type: "text", text: `\`\`\`json\n${JSON.stringify(intake)}\n\`\`\`` }],
      usage: { input_tokens: 120, output_tokens: 80 },
    }));
    const executor = new AnthropicStageExecutor({
      apiKey: "anthropic-secret",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-5",
      request,
    });
    await expect(executor.execute("intake", { concept: "一座时间倒流的城市" })).resolves.toEqual({
      output: intake,
      usage: { inputTokens: 120, outputTokens: 80, costUsd: 0 },
    });
    expect(request).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-api-key": "anthropic-secret", "anthropic-version": "2023-06-01" }),
    }));
  });

  it("routes OpenAI-compatible presets through a configurable base URL", () => {
    const connection = providerBundleSchema.parse({
      llm: {
        modality: "llm",
        providerId: "gemini",
        protocol: "openai-compatible",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        model: "gemini-3.5-flash",
        apiKey: "gemini-secret-key",
        useResponses: false,
      },
    }).llm;
    const executor = createStageExecutor(connection);
    expect(executor).toBeInstanceOf(OpenAICompatibleStageExecutor);
    expect(executor.providerId).toBe("gemini");
  });

  it("falls back from strict JSON schema to JSON object for partial OpenAI compatibility", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":"response_format unsupported"}', { status: 400 }))
      .mockResolvedValueOnce(Response.json({
        choices: [{ message: { content: JSON.stringify(intake) } }],
        usage: { prompt_tokens: 90, completion_tokens: 60 },
      }));
    const executor = new OpenAICompatibleStageExecutor({
      apiKey: "compatible-secret",
      providerId: "custom",
      baseUrl: "https://models.example.com/v1",
      model: "creative-model",
      useResponses: false,
      request,
    });
    await expect(executor.execute("intake", { concept: "一座时间倒流的城市" })).resolves.toMatchObject({
      output: intake,
      usage: { inputTokens: 90, outputTokens: 60 },
    });
    expect(request).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(request.mock.calls[0]?.[1]?.body as string);
    const secondBody = JSON.parse(request.mock.calls[1]?.[1]?.body as string);
    expect(firstBody.response_format.type).toBe("json_schema");
    expect(secondBody.response_format.type).toBe("json_object");
  });
});
