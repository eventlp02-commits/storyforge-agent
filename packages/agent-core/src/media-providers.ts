export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5" | "2.39:1";

export type ImageGenerationRequest = {
  prompt: string;
  aspectRatio: AspectRatio;
  referenceUrls?: string[];
};

export type ImageGenerationResult = {
  status: "queued" | "done" | "prompt-only" | "deferred";
  provider: string;
  model?: string;
  jobId?: string;
  statusUrl?: string;
  url?: string;
  dataUrl?: string;
  revisedPrompt?: string;
};

export interface ImageProvider {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export type VideoGenerationRequest = {
  prompt: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
};

export type VideoGenerationResult = {
  status: "queued" | "done" | "deferred";
  provider: string;
  model?: string;
  jobId?: string;
  statusUrl?: string;
  url?: string;
};

export interface VideoProvider {
  generate(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type ProviderOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
  request?: Fetcher;
};

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function providerError(response: Response, provider: string): Promise<never> {
  const detail = await response.text().catch(() => "");
  const error = new Error(`${provider} generation failed with ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`);
  if (response.status === 401 || response.status === 403) error.name = "CredentialInvalidError";
  throw error;
}

function firstOutputUrl(output: unknown): string | undefined {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.find((item): item is string => typeof item === "string");
  if (output && typeof output === "object") {
    const candidate = output as Record<string, unknown>;
    return typeof candidate.url === "string" ? candidate.url : typeof candidate.uri === "string" ? candidate.uri : undefined;
  }
  return undefined;
}

function replicateModelPath(model: string) {
  const [owner, name] = model.split("/");
  if (!owner || !name) throw new Error("Replicate model must use owner/name format");
  return `models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`;
}

export class DemoImageProvider implements ImageProvider {
  async generate(_request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return { status: "prompt-only", provider: "demo" };
  }
}

export class DisabledVideoProvider implements VideoProvider {
  async generate(_request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    return { status: "deferred", provider: "disabled" };
  }
}

function imageSizeFor(aspectRatio: AspectRatio): "1536x1024" | "1024x1536" | "1024x1024" {
  if (aspectRatio === "9:16" || aspectRatio === "4:5") return "1024x1536";
  if (aspectRatio === "1:1") return "1024x1024";
  return "1536x1024";
}

export class OpenAIImageProvider implements ImageProvider {
  private readonly baseUrl: string;
  private readonly request: Fetcher;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.STORYFORGE_IMAGE_MODEL ?? "gpt-image-2",
    options: { baseUrl?: string; request?: Fetcher } = {},
  ) {
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.request = options.request ?? fetch;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const response = await this.request(endpoint(this.baseUrl, "images/generations"), {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: request.prompt, size: imageSizeFor(request.aspectRatio), n: 1, output_format: "png" }),
    });
    if (!response.ok) return providerError(response, "OpenAI-compatible image");
    const body = await response.json() as { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };
    const first = body.data?.[0];
    if (!first?.b64_json && !first?.url) throw new Error("OpenAI-compatible image generation returned no image data");
    return {
      status: "done",
      provider: "openai",
      model: this.model,
      ...(first.b64_json ? { dataUrl: `data:image/png;base64,${first.b64_json}` } : {}),
      ...(first.url ? { url: first.url } : {}),
      revisedPrompt: first.revised_prompt,
    };
  }
}

export class OpenAIVideoProvider implements VideoProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.STORYFORGE_VIDEO_MODEL,
    private readonly enabled = process.env.STORYFORGE_VIDEO_ENABLED === "true",
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly request: Fetcher = fetch,
  ) {}

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.enabled || !this.model) return { status: "deferred", provider: "openai-video-disabled" };
    const response = await this.request(endpoint(this.baseUrl, "videos"), {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: request.prompt,
        seconds: request.durationSeconds,
        size: request.aspectRatio === "9:16" ? "720x1280" : "1280x720",
      }),
    });
    if (!response.ok) return providerError(response, "OpenAI-compatible video");
    const body = await response.json() as { id?: string; status?: string; url?: string };
    if (!body.id) throw new Error("OpenAI video generation returned no job id");
    return {
      status: body.status === "completed" ? "done" : "queued",
      provider: "openai",
      model: this.model,
      jobId: body.id,
      statusUrl: endpoint(this.baseUrl, `videos/${body.id}`),
      url: body.url,
    };
  }
}

export class ReplicateImageProvider implements ImageProvider {
  private readonly request: Fetcher;

  constructor(private readonly options: ProviderOptions) {
    this.request = options.request ?? fetch;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const response = await this.request(endpoint(this.options.baseUrl, replicateModelPath(this.options.model)), {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json", prefer: "wait=60" },
      body: JSON.stringify({ input: { prompt: request.prompt, aspect_ratio: request.aspectRatio, ...(request.referenceUrls?.length ? { image: request.referenceUrls[0] } : {}) } }),
    });
    if (!response.ok) return providerError(response, "Replicate image");
    const body = await response.json() as { id?: string; status?: string; output?: unknown; urls?: { get?: string } };
    if (!body.id) throw new Error("Replicate image generation returned no prediction id");
    const url = firstOutputUrl(body.output);
    return {
      status: body.status === "succeeded" && url ? "done" : "queued",
      provider: "replicate",
      model: this.options.model,
      jobId: body.id,
      ...(body.urls?.get ? { statusUrl: body.urls.get } : {}),
      ...(url ? { url } : {}),
    };
  }
}

export class ReplicateVideoProvider implements VideoProvider {
  private readonly request: Fetcher;

  constructor(private readonly options: ProviderOptions) {
    this.request = options.request ?? fetch;
  }

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const response = await this.request(endpoint(this.options.baseUrl, replicateModelPath(this.options.model)), {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json", prefer: "wait=60" },
      body: JSON.stringify({ input: { prompt: request.prompt, duration: request.durationSeconds, aspect_ratio: request.aspectRatio } }),
    });
    if (!response.ok) return providerError(response, "Replicate video");
    const body = await response.json() as { id?: string; status?: string; output?: unknown; urls?: { get?: string } };
    if (!body.id) throw new Error("Replicate video generation returned no prediction id");
    const url = firstOutputUrl(body.output);
    return {
      status: body.status === "succeeded" && url ? "done" : "queued",
      provider: "replicate",
      model: this.options.model,
      jobId: body.id,
      ...(body.urls?.get ? { statusUrl: body.urls.get } : {}),
      ...(url ? { url } : {}),
    };
  }
}

export class FalImageProvider implements ImageProvider {
  private readonly request: Fetcher;

  constructor(private readonly options: ProviderOptions) {
    this.request = options.request ?? fetch;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const response = await this.request(endpoint(this.options.baseUrl, this.options.model), {
      method: "POST",
      headers: { authorization: `Key ${this.options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt: request.prompt, aspect_ratio: request.aspectRatio, ...(request.referenceUrls?.length ? { image_url: request.referenceUrls[0] } : {}) }),
    });
    if (!response.ok) return providerError(response, "fal image");
    const body = await response.json() as { request_id?: string; status_url?: string; response_url?: string };
    if (!body.request_id) throw new Error("fal image generation returned no request id");
    const statusUrl = body.status_url ?? body.response_url;
    return { status: "queued", provider: "fal", model: this.options.model, jobId: body.request_id, ...(statusUrl ? { statusUrl } : {}) };
  }
}

export class FalVideoProvider implements VideoProvider {
  private readonly request: Fetcher;

  constructor(private readonly options: ProviderOptions) {
    this.request = options.request ?? fetch;
  }

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const response = await this.request(endpoint(this.options.baseUrl, this.options.model), {
      method: "POST",
      headers: { authorization: `Key ${this.options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt: request.prompt, duration: request.durationSeconds, aspect_ratio: request.aspectRatio }),
    });
    if (!response.ok) return providerError(response, "fal video");
    const body = await response.json() as { request_id?: string; status_url?: string; response_url?: string };
    if (!body.request_id) throw new Error("fal video generation returned no request id");
    const statusUrl = body.status_url ?? body.response_url;
    return { status: "queued", provider: "fal", model: this.options.model, jobId: body.request_id, ...(statusUrl ? { statusUrl } : {}) };
  }
}

function runwayImageRatio(aspectRatio: AspectRatio) {
  if (aspectRatio === "2.39:1") return "16:9";
  return aspectRatio;
}

function runwayVideoRatio(aspectRatio: AspectRatio) {
  if (aspectRatio === "9:16" || aspectRatio === "4:5") return "720:1280";
  if (aspectRatio === "1:1") return "960:960";
  return "1280:720";
}

export class RunwayImageProvider implements ImageProvider {
  private readonly request: Fetcher;

  constructor(private readonly options: ProviderOptions) {
    this.request = options.request ?? fetch;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const response = await this.request(endpoint(this.options.baseUrl, "text_to_image"), {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json", "x-runway-version": "2024-11-06" },
      body: JSON.stringify({ model: this.options.model, promptText: request.prompt, ratio: runwayImageRatio(request.aspectRatio), outputCount: 1 }),
    });
    if (!response.ok) return providerError(response, "Runway image");
    const body = await response.json() as { id?: string };
    if (!body.id) throw new Error("Runway image generation returned no task id");
    return {
      status: "queued",
      provider: "runway",
      model: this.options.model,
      jobId: body.id,
      statusUrl: endpoint(this.options.baseUrl, `tasks/${body.id}`),
    };
  }
}

export class RunwayVideoProvider implements VideoProvider {
  private readonly request: Fetcher;

  constructor(private readonly options: ProviderOptions) {
    this.request = options.request ?? fetch;
  }

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const response = await this.request(endpoint(this.options.baseUrl, "text_to_video"), {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json", "x-runway-version": "2024-11-06" },
      body: JSON.stringify({ model: this.options.model, promptText: request.prompt, ratio: runwayVideoRatio(request.aspectRatio), duration: request.durationSeconds }),
    });
    if (!response.ok) return providerError(response, "Runway video");
    const body = await response.json() as { id?: string };
    if (!body.id) throw new Error("Runway video generation returned no task id");
    return {
      status: "queued",
      provider: "runway",
      model: this.options.model,
      jobId: body.id,
      statusUrl: endpoint(this.options.baseUrl, `tasks/${body.id}`),
    };
  }
}

export function createImageProvider(connection: import("./provider-hub").ProviderConnection): ImageProvider {
  if (connection.modality !== "image") throw new Error("Image generation requires an image provider");
  const options = { apiKey: connection.apiKey, model: connection.model, baseUrl: connection.baseUrl };
  if (connection.protocol === "openai-images") return new OpenAIImageProvider(connection.apiKey, connection.model, { baseUrl: connection.baseUrl });
  if (connection.protocol === "replicate") return new ReplicateImageProvider(options);
  if (connection.protocol === "fal") return new FalImageProvider(options);
  if (connection.protocol === "runway") return new RunwayImageProvider(options);
  throw new Error(`Unsupported image protocol: ${connection.protocol}`);
}

export function createVideoProvider(connection: import("./provider-hub").ProviderConnection): VideoProvider {
  if (connection.modality !== "video") throw new Error("Video generation requires a video provider");
  const options = { apiKey: connection.apiKey, model: connection.model, baseUrl: connection.baseUrl };
  if (connection.protocol === "openai-video") return new OpenAIVideoProvider(connection.apiKey, connection.model, true, connection.baseUrl);
  if (connection.protocol === "replicate") return new ReplicateVideoProvider(options);
  if (connection.protocol === "fal") return new FalVideoProvider(options);
  if (connection.protocol === "runway") return new RunwayVideoProvider(options);
  throw new Error(`Unsupported video protocol: ${connection.protocol}`);
}
