import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const safePart = /^[a-zA-Z0-9_-]+$/;
const safeFile = /^[a-zA-Z0-9_-]+\.(?:png|jpg|webp)$/;

export async function GET(_request: Request, context: { params: Promise<{ runId: string; filename: string }> }) {
  const { runId, filename } = await context.params;
  if (!safePart.test(runId) || !safeFile.test(filename)) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const bytes = await readFile(join(tmpdir(), "storyforge-agent", runId, filename));
    const contentType = filename.endsWith(".webp") ? "image/webp" : filename.endsWith(".jpg") ? "image/jpeg" : "image/png";
    return new Response(bytes, { headers: { "content-type": contentType, "cache-control": "private, max-age=3600" } });
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}
