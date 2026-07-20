export type ProviderErrorKind = "authentication" | "rate-limit" | "structured-output" | "refusal" | "other";

type ErrorLike = { status?: unknown; code?: unknown; name?: unknown; message?: unknown };

export function classifyProviderError(error: unknown): ProviderErrorKind {
  const candidate = error && typeof error === "object" ? error as ErrorLike : {};
  const status = Number(candidate.status);
  const code = String(candidate.code ?? "").toLowerCase();
  const name = String(candidate.name ?? "").toLowerCase();
  const message = String(candidate.message ?? "").toLowerCase();
  if (status === 401 || status === 403 || code.includes("invalid_api_key") || code.includes("authentication")) return "authentication";
  if (status === 429 || code.includes("rate_limit") || message.includes("rate limit")) return "rate-limit";
  if (code.includes("content_policy") || code.includes("refusal") || message.includes("request was refused")) return "refusal";
  if (name.includes("zod") || code.includes("invalid_output") || message.includes("structured output") || message.includes("schema validation")) return "structured-output";
  return "other";
}

export function retryPolicyFor(kind: ProviderErrorKind): { maxRetries: number; delaysMs: number[] } {
  if (kind === "rate-limit") return { maxRetries: 3, delaysMs: [500, 1000, 2000] };
  if (kind === "structured-output") return { maxRetries: 1, delaysMs: [250] };
  return { maxRetries: 0, delaysMs: [] };
}
