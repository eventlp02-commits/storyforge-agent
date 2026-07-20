import { describe, expect, it } from "vitest";
import { DemoImageProvider, DisabledVideoProvider } from "../../src/media-providers";

describe("media providers", () => {
  it("keeps demo images as prompt-only without paid calls", async () => {
    const result = await new DemoImageProvider().generate({ prompt: "原创浮空城市", aspectRatio: "16:9" });
    expect(result.status).toBe("prompt-only");
  });

  it("keeps video disabled by default", async () => {
    const result = await new DisabledVideoProvider().generate({ prompt: "空艇穿越云海", durationSeconds: 8, aspectRatio: "16:9" });
    expect(result.status).toBe("deferred");
  });
});
