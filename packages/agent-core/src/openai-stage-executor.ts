import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import type { StageName } from "@storyforge/contracts";
import { stageOutputSchemas } from "./agent-schemas";
import { promptBundle } from "./generated/skill-bundle";
import { classifyProviderError, retryPolicyFor } from "./error-policy";
import type { StageExecutionResult, StageExecutor } from "./workflow";

export type OpenAIStageExecutorOptions = {
  apiKey: string;
  qualityMode?: boolean;
  signal?: AbortSignal;
  onStreamEvent?: (event: { type: "agent" | "tool"; stage: StageName; detail: string }) => void;
};

const stageInstructions: Record<StageName, string> = {
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

export class OpenAIStageExecutor implements StageExecutor {
  private readonly provider: OpenAIProvider;
  private readonly runner: Runner;

  constructor(private readonly options: OpenAIStageExecutorOptions) {
    this.provider = new OpenAIProvider({ apiKey: options.apiKey, useResponses: true });
    this.runner = new Runner({
      modelProvider: this.provider,
      traceIncludeSensitiveData: false,
      tracingDisabled: false,
      workflowName: "StoryForge Agent",
    });
  }

  async execute(stage: StageName, input: Record<string, unknown>): Promise<StageExecutionResult> {
    const schema = stageOutputSchemas[stage];
    let retryCount = 0;
    while (true) {
      try {
        const agent = new Agent({
          name: `StoryForge ${stage}`,
          model: modelForStage(stage, this.options.qualityMode ?? false),
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

  async close() {
    await this.provider.close();
  }
}
