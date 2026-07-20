import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import { z } from "zod";
import type { StageName } from "@storyforge/contracts";
import { stageOutputSchemas } from "./agent-schemas";
import { promptBundle } from "./generated/skill-bundle";
import { classifyProviderError, retryPolicyFor } from "./error-policy";
import type { StageExecutionResult, StageExecutor } from "./workflow";

export type OpenAICompatibleStageExecutorOptions = {
  apiKey: string;
  providerId: string;
  baseUrl: string;
  model?: string;
  useResponses?: boolean;
  request?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  qualityMode?: boolean;
  signal?: AbortSignal;
  onStreamEvent?: (event: { type: "agent" | "tool"; stage: StageName; detail: string }) => void;
};

export type OpenAIStageExecutorOptions = Omit<OpenAICompatibleStageExecutorOptions, "providerId" | "baseUrl"> & {
  baseUrl?: string;
};

export const stageInstructions: Record<StageName, string> = {
  intake: "Extract and infer a production brief. Make consequential assumptions explicit.",
  "story-architect": "Design an original story, brand, or world structure that closes exactly to the requested duration.",
  "art-director": "Create a coherent visual system, continuity locks, and an original art direction suited to the format.",
  scriptwriter: "Write playable action, dialogue, narration, supers, and transitions within the allocated timing.",
  "asset-director": "Plan reusable characters, locations, props, creatures, vehicles, food, flora, graphics, and effects before media generation.",
  "audio-director": "Design dialogue, narration, ambience, effects, music intent, and useful silence without assuming unsupported audio features.",
  "shot-designer": "Create contiguous shots with exact start and end times, camera language, actions, sound, transitions, and resolvable asset IDs.",
  "prompt-engineer": "Compile project, asset, segment, and shot prompts with continuity locks and model-agnostic safety constraints.",
  "qa-critic": "Verify exact timing, dialogue capacity, continuity, asset references, originality, and prompt completeness. Request only targeted repairs.",
  packager: "Produce a deterministic manifest for Markdown, JSON, CSV, DOCX, ZIP, assets, and optional generated media.",
};

function modelForStage(stage: StageName, qualityMode: boolean): string {
  if (qualityMode) return process.env.STORYFORGE_QUALITY_MODEL ?? "gpt-5.6-sol";
  if (stage === "intake" || stage === "packager") return process.env.STORYFORGE_UTILITY_MODEL ?? "gpt-5.6-luna";
  return process.env.STORYFORGE_CREATIVE_MODEL ?? "gpt-5.6-terra";
}

export class OpenAICompatibleStageExecutor implements StageExecutor {
  private readonly provider: OpenAIProvider;
  private readonly runner: Runner;
  readonly providerId: string;
  private readonly request: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

  constructor(private readonly options: OpenAICompatibleStageExecutorOptions) {
    this.providerId = options.providerId;
    this.request = options.request ?? fetch;
    this.provider = new OpenAIProvider({ apiKey: options.apiKey, baseURL: options.baseUrl, useResponses: options.useResponses ?? false });
    this.runner = new Runner({
      modelProvider: this.provider,
      traceIncludeSensitiveData: false,
      tracingDisabled: options.providerId !== "openai",
      workflowName: "StoryForge Agent",
    });
  }

  async execute(stage: StageName, input: Record<string, unknown>): Promise<StageExecutionResult> {
    if (this.providerId !== "openai") return this.executeCompatible(stage, input);
    const schema = stageOutputSchemas[stage];
    let retryCount = 0;
    while (true) {
      try {
        const agent = new Agent({
          name: `StoryForge ${stage}`,
          model: this.options.model ?? modelForStage(stage, this.options.qualityMode ?? false),
          instructions: `${promptBundle.content}\n\nCURRENT STAGE\n${stageInstructions[stage]}\nReturn only the structured output required by the schema. Never expose hidden reasoning.${retryCount > 0 ? "\nA previous response could not be accepted. Rebuild the complete structured response from the supplied inputs." : ""}`,
          outputType: schema,
        });
        const stream = await this.runner.run(agent, JSON.stringify(input), {
          stream: true,
          signal: this.options.signal,
          maxTurns: 4,
        });
        for await (const event of stream) {
          if (event.type === "agent_updated_stream_event") {
            this.options.onStreamEvent?.({ type: "agent", stage, detail: "Agent context updated" });
          } else if (event.type === "run_item_stream_event" && event.name.includes("tool")) {
            this.options.onStreamEvent?.({ type: "tool", stage, detail: "A configured tool completed" });
          }
        }
        await stream.completed;
        if (stream.finalOutput === undefined) {
          const error = new Error(`${stage} returned no structured output`);
          error.name = "StructuredOutputError";
          throw error;
        }
        return {
          output: stream.finalOutput,
          usage: {
            inputTokens: stream.runContext.usage.inputTokens,
            outputTokens: stream.runContext.usage.outputTokens,
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
        this.options.onStreamEvent?.({ type: "agent", stage, detail: `Provider retry ${retryCount} scheduled` });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async executeCompatible(stage: StageName, input: Record<string, unknown>): Promise<StageExecutionResult> {
    const schema = stageOutputSchemas[stage];
    const jsonSchema = z.toJSONSchema(schema);
    const formats: Array<Record<string, unknown> | undefined> = [
      { type: "json_schema", json_schema: { name: `storyforge_${stage.replaceAll("-", "_")}`, strict: true, schema: jsonSchema } },
      { type: "json_object" },
      undefined,
    ];
    let retryCount = 0;
    while (true) {
      try {
        for (const [formatIndex, responseFormat] of formats.entries()) {
          this.options.onStreamEvent?.({ type: "agent", stage, detail: `${this.providerId} compatible request started` });
          const response = await this.request(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({
              model: this.options.model,
              messages: [
                {
                  role: "system",
                  content: `${promptBundle.content}\n\nCURRENT STAGE\n${stageInstructions[stage]}\nReturn exactly one JSON object matching the supplied schema. Never expose hidden reasoning.\n\nJSON SCHEMA\n${JSON.stringify(jsonSchema)}`,
                },
                { role: "user", content: JSON.stringify(input) },
              ],
              ...(responseFormat ? { response_format: responseFormat } : {}),
            }),
            signal: this.options.signal,
          });
          if (!response.ok) {
            if ((response.status === 400 || response.status === 404 || response.status === 422) && formatIndex < formats.length - 1) {
              await response.text().catch(() => "");
              continue;
            }
            const error = new Error(`${this.providerId} request failed with ${response.status}: ${(await response.text().catch(() => "")).slice(0, 240)}`) as Error & { status: number };
            error.status = response.status;
            throw error;
          }
          const body = await response.json() as {
            choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const content = body.choices?.[0]?.message?.content;
          const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((block) => block.text ?? "").join("\n") : "";
          if (!text) throw new Error(`${stage} returned no structured output`);
          const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
          let parsed: unknown;
          try {
            parsed = JSON.parse(unfenced);
          } catch {
            const start = unfenced.indexOf("{");
            const end = unfenced.lastIndexOf("}");
            if (start < 0 || end <= start) throw new Error(`${stage} returned invalid structured output`);
            parsed = JSON.parse(unfenced.slice(start, end + 1));
          }
          return {
            output: schema.parse(parsed),
            usage: {
              inputTokens: body.usage?.prompt_tokens ?? 0,
              outputTokens: body.usage?.completion_tokens ?? 0,
              costUsd: 0,
            },
          };
        }
        throw new Error(`${stage} could not negotiate a structured output format`);
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

  async close() {
    await this.provider.close();
  }
}

export class OpenAIStageExecutor extends OpenAICompatibleStageExecutor {
  constructor(options: OpenAIStageExecutorOptions) {
    super({
      ...options,
      providerId: "openai",
      baseUrl: options.baseUrl ?? "https://api.openai.com/v1",
      useResponses: options.useResponses ?? true,
    });
  }
}
