export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5" | "2.39:1";

export type ImageGenerationRequest = {
  prompt: string;
  aspectRatio: AspectRatio;
  referenceUrls?: string[];
};

export type ImageGenerationResult = {
  status: "done" | "prompt-only" | "deferred";
  provider: string;
  model?: string;
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
  url?: string;
};

export interface VideoProvider {
  generate(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
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
  constructor(private readonly apiKey: string, private readonly model = process.env.STORYFORGE_IMAGE_MODEL ?? "gpt-image-2") {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: request.prompt, size: imageSizeFor(request.aspectRatio), n: 1, output_format: "png" }),
    });
    if (!response.ok) throw new Error(`OpenAI image generation failed with ${response.status}`);
    const body = await response.json() as { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
    const first = body.data?.[0];
    if (!first?.b64_json) throw new Error("OpenAI image generation returned no image data");
    return {
      status: "done",
      provider: "openai",
      model: this.model,
      dataUrl: `data:image/png;base64,${first.b64_json}`,
      revisedPrompt: first.revised_prompt,
    };
  }
}

export class OpenAIVideoProvider implements VideoProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.STORYFORGE_VIDEO_MODEL,
    private readonly enabled = process.env.STORYFORGE_VIDEO_ENABLED === "true",
  ) {}

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.enabled || !this.model) return { status: "deferred", provider: "openai-video-disabled" };
    const response = await fetch("https://api.openai.com/v1/videos", {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: request.prompt,
        seconds: request.durationSeconds,
        size: request.aspectRatio === "9:16" ? "720x1280" : "1280x720",
      }),
    });
    if (!response.ok) throw new Error(`OpenAI video generation failed with ${response.status}`);
    const body = await response.json() as { id?: string; status?: string; url?: string };
    if (!body.id) throw new Error("OpenAI video generation returned no job id");
    return { status: body.status === "completed" ? "done" : "queued", provider: "openai", model: this.model, jobId: body.id, url: body.url };
  }
}
