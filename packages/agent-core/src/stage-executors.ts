import { z } from "zod";
import type { StageName } from "@storyforge/contracts";
import { stageOutputSchemas } from "./agent-schemas";
import { classifyProviderError, retryPolicyFor } from "./error-policy";
import { promptBundle } from "./generated/skill-bundle";
import { OpenAICompatibleStageExecutor, stageInstructions } from "./openai-stage-executor";
import type { ProviderConnection } from "./provider-hub";
import { joinProviderEndpoint } from "./provider-hub";
import type { StageExecutionResult, StageExecutor } from "./workflow";

export { OpenAICompatibleStageExecutor } from "./openai-stage-executor";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type StageExecutorRuntimeOptions = {
  qualityMode?: boolean;
  signal?: AbortSignal;
  request?: Fetcher;
  onStreamEvent?: (event: { type: "agent" | "tool"; stage: StageName; detail: string }) => void;
};

export interface ClosableStageExecutor extends StageExecutor {
  readonly providerId: string;
  close(): Promise<void>;
}

function jsonFromModelText(text: string): unknown {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Provider returned no JSON object");
    return JSON.parse(unfenced.slice(start, end + 1));
  }
}

function httpError(provider: string, status: number, detail: string) {
  const error = new Error(`${provider} request failed with ${status}${detail ? `: ${detail.slice(0, 240)}` : ""}`) as Error & { status: number };
  error.status = status;
  return error;
}

export class AnthropicStageExecutor implements ClosableStageExecutor {
  private readonly request: Fetcher;
  readonly providerId: string;

  constructor(private readonly options: {
    apiKey: string;
    baseUrl: string;
    model: string;
    providerId?: string;
    signal?: AbortSignal;
    request?: Fetcher;
    onStreamEvent?: StageExecutorRuntimeOptions["onStreamEvent"];
  }) {
    this.providerId = options.providerId ?? "anthropic";
    this.request = options.request ?? fetch;
  }

  async execute(stage: StageName, input: Record<string, unknown>): Promise<StageExecutionResult> {
    const schema = stageOutputSchemas[stage];
    let retryCount = 0;
    while (true) {
      try {
        this.options.onStreamEvent?.({ type: "agent", stage, detail: `${this.providerId} Messages request started` });
        const response = await this.request(joinProviderEndpoint(this.options.baseUrl, "messages"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.options.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: this.options.model,
            max_tokens: 16_384,
            system: `${promptBundle.content}\n\nCURRENT STAGE\n${stageInstructions[stage]}\nReturn exactly one JSON object matching this schema. Do not wrap it in commentary and never expose hidden reasoning.\n\nJSON SCHEMA\n${JSON.stringify(z.toJSONSchema(schema))}`,
            messages: [{ role: "user", content: JSON.stringify(input) }],
          }),
          signal: this.options.signal,
        });
        if (!response.ok) throw httpError(this.providerId, response.status, await response.text().catch(() => ""));
        const body = await response.json() as {
          content?: Array<{ type?: string; text?: string }>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const text = body.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n");
        if (!text) throw new Error(`${stage} returned no structured output`);
        const output = schema.parse(jsonFromModelText(text));
        return {
          output,
          usage: {
            inputTokens: body.usage?.input_tokens ?? 0,
            outputTokens: body.usage?.output_tokens ?? 0,
            costUsd: 0,
          },
        };
      } catch (error) {
        const kind = classifyProviderError(error);
        if (kind === "authentication") {
          const credentialError = new Error("The temporary provider credential was rejected");
          credentialError.name = "CredentialInvalidError";
          throw credentialError;
        }
        const policy = retryPolicyFor(kind);
        if (retryCount >= policy.maxRetries) throw error;
        const delay = policy.delaysMs[retryCount] ?? 0;
        retryCount += 1;
        this.options.onStreamEvent?.({ type: "agent", stage, detail: `${this.providerId} retry ${retryCount} scheduled` });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async close() {}
}

export function createStageExecutor(connection: ProviderConnection, options: StageExecutorRuntimeOptions = {}): ClosableStageExecutor {
  if (connection.modality !== "llm") throw new Error("Stage execution requires an LLM provider");
  if (connection.protocol === "anthropic") {
    return new AnthropicStageExecutor({
      apiKey: connection.apiKey,
      baseUrl: connection.baseUrl,
      model: connection.model,
      providerId: connection.providerId,
      signal: options.signal,
      request: options.request,
      onStreamEvent: options.onStreamEvent,
    });
  }
  return new OpenAICompatibleStageExecutor({
    apiKey: connection.apiKey,
    providerId: connection.providerId,
    baseUrl: connection.baseUrl,
    model: connection.model,
    useResponses: connection.useResponses,
    request: options.request,
    qualityMode: options.qualityMode,
    signal: options.signal,
    onStreamEvent: options.onStreamEvent,
  });
}
