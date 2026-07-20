import { describe, expect, it, vi } from "vitest";
import {
  DemoImageProvider,
  DisabledVideoProvider,
  FalImageProvider,
  ReplicateVideoProvider,
  RunwayImageProvider,
  RunwayVideoProvider,
} from "../../src/media-providers";

describe("media providers", () => {
  it("keeps demo images as prompt-only without paid calls", async () => {
    const result = await new DemoImageProvider().generate({ prompt: "原创浮空城市", aspectRatio: "16:9" });
    expect(result.status).toBe("prompt-only");
  });

  it("keeps video disabled by default", async () => {
    const result = await new DisabledVideoProvider().generate({ prompt: "空艇穿越云海", durationSeconds: 8, aspectRatio: "16:9" });
    expect(result.status).toBe("deferred");
  });

  it("submits fal image jobs through the durable queue", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ request_id: "fal-job-1", status_url: "https://queue.fal.run/status/1" }));
    const provider = new FalImageProvider({ apiKey: "fal-secret", model: "fal-ai/flux/schnell", baseUrl: "https://queue.fal.run", request });
    await expect(provider.generate({ prompt: "原创浮空港", aspectRatio: "16:9" })).resolves.toEqual({
      status: "queued",
      provider: "fal",
      model: "fal-ai/flux/schnell",
      jobId: "fal-job-1",
      statusUrl: "https://queue.fal.run/status/1",
    });
    expect(request).toHaveBeenCalledWith("https://queue.fal.run/fal-ai/flux/schnell", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Key fal-secret" }),
    }));
  });

  it("uses a single Replicate prediction adapter for arbitrary video models", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ id: "rep-job-1", status: "processing", urls: { get: "https://api.replicate.com/v1/predictions/rep-job-1" } }));
    const provider = new ReplicateVideoProvider({ apiKey: "replicate-secret", model: "minimax/video-01", baseUrl: "https://api.replicate.com/v1", request });
    await expect(provider.generate({ prompt: "飞船穿越云海", durationSeconds: 6, aspectRatio: "16:9" })).resolves.toMatchObject({
      status: "queued",
      provider: "replicate",
      jobId: "rep-job-1",
      statusUrl: "https://api.replicate.com/v1/predictions/rep-job-1",
    });
    expect(request).toHaveBeenCalledWith("https://api.replicate.com/v1/models/minimax/video-01/predictions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer replicate-secret", prefer: "wait=60" }),
    }));
  });

  it("uses aspect-ratio notation for Runway image jobs", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ id: "runway-image-1" }));
    const provider = new RunwayImageProvider({ apiKey: "runway-secret", model: "seedream-5", baseUrl: "https://api.dev.runwayml.com/v1", request });
    await expect(provider.generate({ prompt: "原创浮空都市", aspectRatio: "16:9" })).resolves.toMatchObject({
      status: "queued",
      jobId: "runway-image-1",
      statusUrl: "https://api.dev.runwayml.com/v1/tasks/runway-image-1",
    });
    const requestBody = JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string) as { ratio: string };
    expect(requestBody.ratio).toBe("16:9");
  });

  it("submits Runway text-to-video jobs with the configured model", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ id: "runway-job-1" }));
    const provider = new RunwayVideoProvider({ apiKey: "runway-secret", model: "seedance2_mini", baseUrl: "https://api.dev.runwayml.com/v1", request });
    await expect(provider.generate({ prompt: "原创骑士穿越风暴", durationSeconds: 8, aspectRatio: "9:16" })).resolves.toMatchObject({
      status: "queued",
      provider: "runway",
      jobId: "runway-job-1",
    });
    expect(request).toHaveBeenCalledWith("https://api.dev.runwayml.com/v1/text_to_video", expect.objectContaining({
      headers: expect.objectContaining({ "x-runway-version": "2024-11-06" }),
    }));
    const requestBody = JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string) as { ratio: string };
    expect(requestBody.ratio).toBe("720:1280");
  });
});
