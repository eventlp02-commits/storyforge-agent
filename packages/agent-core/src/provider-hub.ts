import { z } from "zod";

export const providerModalitySchema = z.enum(["llm", "image", "video"]);
export const providerProtocolSchema = z.enum([
  "openai-compatible",
  "anthropic",
  "openai-images",
  "openai-video",
  "replicate",
  "fal",
  "runway",
]);

export type ProviderModality = z.infer<typeof providerModalitySchema>;
export type ProviderProtocol = z.infer<typeof providerProtocolSchema>;

const privateIpv4 = /^(?:0|10|127|169\.254|192\.168|172\.(?:1[6-9]|2\d|3[01]))(?:\.|$)/;

function normalizedPublicBaseUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const bareHostname = hostname.replace(/^\[|\]$/g, "");
  const mappedIpv4 = bareHostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const privateIpv6 = bareHostname === "::" || bareHostname === "::1" || /^(?:fc|fd|fe[89ab])/i.test(bareHostname);
  if (url.protocol !== "https:") throw new Error("Provider Base URL must use HTTPS");
  if (url.username || url.password) throw new Error("Provider Base URL cannot contain credentials");
  if (bareHostname === "localhost" || bareHostname.endsWith(".local") || privateIpv6 || privateIpv4.test(bareHostname) || (mappedIpv4 && privateIpv4.test(mappedIpv4))) {
    throw new Error("Provider Base URL cannot target a private network");
  }
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

const publicBaseUrlSchema = z.string().trim().url().transform((value, context) => {
  try {
    return normalizedPublicBaseUrl(value);
  } catch (error) {
    context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Invalid provider Base URL" });
    return z.NEVER;
  }
});

const protocolByModality: Record<ProviderModality, ProviderProtocol[]> = {
  llm: ["openai-compatible", "anthropic"],
  image: ["openai-images", "replicate", "fal", "runway"],
  video: ["openai-video", "replicate", "fal", "runway"],
};

export const providerConnectionSchema = z.object({
  modality: providerModalitySchema,
  providerId: z.string().trim().min(1).max(80),
  protocol: providerProtocolSchema,
  baseUrl: publicBaseUrlSchema,
  model: z.string().trim().min(1).max(300),
  apiKey: z.string().trim().min(8).max(1000),
  useResponses: z.boolean().optional(),
  enabled: z.boolean().default(true),
}).superRefine((connection, context) => {
  if (!protocolByModality[connection.modality].includes(connection.protocol)) {
    context.addIssue({ code: "custom", path: ["protocol"], message: `${connection.protocol} cannot be used for ${connection.modality}` });
  }
});

export const providerBundleSchema = z.object({
  llm: providerConnectionSchema.refine((connection) => connection.modality === "llm", { message: "A valid LLM provider is required" }),
  image: providerConnectionSchema.refine((connection) => connection.modality === "image", { message: "Invalid image provider" }).optional(),
  video: providerConnectionSchema.refine((connection) => connection.modality === "video", { message: "Invalid video provider" }).optional(),
  limits: z.object({
    maxImages: z.number().int().min(0).max(50).default(0),
    maxVideoSeconds: z.number().min(0).max(300).default(0),
  }).default({ maxImages: 0, maxVideoSeconds: 0 }),
});

export type ProviderConnection = z.infer<typeof providerConnectionSchema>;
export type ProviderBundle = z.infer<typeof providerBundleSchema>;
export type PublicProviderConnection = Omit<ProviderConnection, "apiKey">;
export type PublicProviderBundle = {
  llm: PublicProviderConnection;
  image?: PublicProviderConnection;
  video?: PublicProviderConnection;
  limits: ProviderBundle["limits"];
};

export type ProviderPreset = {
  id: string;
  label: string;
  modality: ProviderModality;
  protocol: ProviderProtocol;
  baseUrl: string;
  model: string;
  useResponses?: boolean;
  description: string;
};

const providerPresets: ProviderPreset[] = [
  { id: "openai", label: "OpenAI", modality: "llm", protocol: "openai-compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-sol", useResponses: true, description: "OpenAI Responses API" },
  { id: "anthropic", label: "Anthropic Claude", modality: "llm", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-5", description: "Claude Messages API" },
  { id: "gemini", label: "Google Gemini", modality: "llm", protocol: "openai-compatible", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.5-flash", description: "Gemini OpenAI compatibility" },
  { id: "deepseek", label: "DeepSeek", modality: "llm", protocol: "openai-compatible", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", description: "DeepSeek OpenAI format" },
  { id: "qwen", label: "通义千问 / DashScope", modality: "llm", protocol: "openai-compatible", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen3.7-plus", description: "阿里云百炼兼容接口" },
  { id: "kimi", label: "月之暗面 Kimi", modality: "llm", protocol: "openai-compatible", baseUrl: "https://api.moonshot.cn/v1", model: "kimi-k2.5", description: "Moonshot OpenAI-compatible API" },
  { id: "groq", label: "Groq", modality: "llm", protocol: "openai-compatible", baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", description: "Groq OpenAI-compatible API" },
  { id: "mistral", label: "Mistral AI", modality: "llm", protocol: "openai-compatible", baseUrl: "https://api.mistral.ai/v1", model: "mistral-large-latest", description: "Mistral OpenAI-compatible API" },
  { id: "xai", label: "xAI Grok", modality: "llm", protocol: "openai-compatible", baseUrl: "https://api.x.ai/v1", model: "grok-4-1-fast-reasoning", description: "xAI OpenAI-compatible API" },
  { id: "openrouter", label: "OpenRouter", modality: "llm", protocol: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-5.4-mini", description: "One key for many hosted LLMs" },
  { id: "together", label: "Together AI", modality: "llm", protocol: "openai-compatible", baseUrl: "https://api.together.xyz/v1", model: "moonshotai/Kimi-K2.5", description: "Hosted open and commercial models" },
  { id: "siliconflow", label: "硅基流动 SiliconFlow", modality: "llm", protocol: "openai-compatible", baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3.2", description: "国内多模型兼容接口" },
  { id: "custom", label: "自定义兼容接口", modality: "llm", protocol: "openai-compatible", baseUrl: "https://example.com/v1", model: "your-model", description: "Any public HTTPS OpenAI-compatible endpoint" },

  { id: "openai", label: "OpenAI Images", modality: "image", protocol: "openai-images", baseUrl: "https://api.openai.com/v1", model: "gpt-image-2", description: "OpenAI image generations" },
  { id: "replicate", label: "Replicate", modality: "image", protocol: "replicate", baseUrl: "https://api.replicate.com/v1", model: "black-forest-labs/flux-1.1-pro", description: "Run any Replicate image model" },
  { id: "fal", label: "fal", modality: "image", protocol: "fal", baseUrl: "https://queue.fal.run", model: "fal-ai/flux-pro/v1.1", description: "Durable queue for image models" },
  { id: "runway", label: "Runway", modality: "image", protocol: "runway", baseUrl: "https://api.dev.runwayml.com/v1", model: "seedream5_pro", description: "Runway and hosted third-party image models" },
  { id: "custom", label: "自定义图片接口", modality: "image", protocol: "openai-images", baseUrl: "https://example.com/v1", model: "your-image-model", description: "Any public HTTPS OpenAI Images-compatible endpoint" },

  { id: "openai", label: "OpenAI Video", modality: "video", protocol: "openai-video", baseUrl: "https://api.openai.com/v1", model: "sora-2", description: "OpenAI video jobs" },
  { id: "replicate", label: "Replicate", modality: "video", protocol: "replicate", baseUrl: "https://api.replicate.com/v1", model: "minimax/video-01", description: "Kling, Minimax, Luma and other hosted models" },
  { id: "fal", label: "fal", modality: "video", protocol: "fal", baseUrl: "https://queue.fal.run", model: "fal-ai/kling-video/v2.1/master/text-to-video", description: "Durable queue for video models" },
  { id: "runway", label: "Runway", modality: "video", protocol: "runway", baseUrl: "https://api.dev.runwayml.com/v1", model: "seedance2_mini", description: "Runway, Veo, Seedance and hosted video models" },
  { id: "custom", label: "自定义视频接口", modality: "video", protocol: "openai-video", baseUrl: "https://example.com/v1", model: "your-video-model", description: "Any public HTTPS OpenAI Video-compatible endpoint" },
];

export function listProviderPresets(modality: ProviderModality) {
  return providerPresets.filter((preset) => preset.modality === modality);
}

export function getProviderPreset(modality: ProviderModality, id: string) {
  const preset = providerPresets.find((candidate) => candidate.modality === modality && candidate.id === id);
  if (!preset) throw new Error(`Unknown ${modality} provider preset: ${id}`);
  return preset;
}

function withoutApiKey(connection: ProviderConnection): PublicProviderConnection {
  const { apiKey: _apiKey, ...safe } = connection;
  return safe;
}

export function sanitizeProviderBundle(bundle: ProviderBundle): PublicProviderBundle {
  return {
    llm: withoutApiKey(bundle.llm),
    ...(bundle.image ? { image: withoutApiKey(bundle.image) } : {}),
    ...(bundle.video ? { video: withoutApiKey(bundle.video) } : {}),
    limits: bundle.limits,
  };
}

export function credentialStorageKey(connection: Pick<ProviderConnection, "modality" | "providerId">) {
  return `${connection.modality}:${connection.providerId}`;
}

export function joinProviderEndpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type ProviderValidationResult =
  | { valid: true; verification: "verified" | "deferred" }
  | { valid: false; reason: "invalid_api_key" };

export async function validateProviderConnection(connection: ProviderConnection, request: Fetcher = fetch): Promise<ProviderValidationResult> {
  if (connection.protocol === "fal") return { valid: true, verification: "deferred" };

  let endpoint: string;
  let headers: Record<string, string>;
  if (connection.protocol === "anthropic") {
    endpoint = joinProviderEndpoint(connection.baseUrl, "models");
    headers = { "x-api-key": connection.apiKey, "anthropic-version": "2023-06-01" };
  } else if (connection.protocol === "replicate") {
    endpoint = joinProviderEndpoint(connection.baseUrl, "account");
    headers = { authorization: `Bearer ${connection.apiKey}` };
  } else if (connection.protocol === "runway") {
    endpoint = joinProviderEndpoint(connection.baseUrl, "organization");
    headers = { authorization: `Bearer ${connection.apiKey}`, "x-runway-version": "2024-11-06" };
  } else {
    endpoint = joinProviderEndpoint(connection.baseUrl, "models");
    headers = { authorization: `Bearer ${connection.apiKey}` };
  }

  try {
    const response = await request(endpoint, { method: "GET", headers, signal: AbortSignal.timeout(10_000) });
    if (response.status === 401) return { valid: false, reason: "invalid_api_key" };
    if (response.ok || response.status === 429) return { valid: true, verification: "verified" };
    return { valid: true, verification: "deferred" };
  } catch {
    return { valid: true, verification: "deferred" };
  }
}
