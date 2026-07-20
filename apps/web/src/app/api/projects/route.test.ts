import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/projects", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("creates a local live run without GitHub or cloud configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "");
    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ concept: "一座城市每天醒来都会更换一种重力", mode: "live" }),
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toMatchObject({ backend: "local", credentialRequired: true });
    expect(body.projectId).toBeTruthy();
    expect(body.runId).toBeTruthy();
  });
});
