import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createFixtureRun } from "@storyforge/agent-core";
import { projectSnapshotSchema } from "@storyforge/contracts";

type EvalCase = { id: string; category: string; duration: number; prompt: string };
const cases = JSON.parse(await readFile(resolve("evals/cases.json"), "utf8")) as EvalCase[];
const rows = [];

for (const item of cases) {
  const started = performance.now();
  const project = await createFixtureRun(item.prompt, { durationSeconds: item.duration });
  rows.push({
    id: item.id,
    category: item.category,
    schemaValid: projectSnapshotSchema.safeParse(project).success,
    timingValid: project.timeline.valid,
    timingDifference: project.timeline.difference,
    unresolvedAssets: project.unresolvedAssetIds.length,
    qaScore: project.qa.score,
    eventCount: project.events.length,
    latencyMs: Math.round((performance.now() - started) * 100) / 100,
    costUsd: project.usage.costUsd,
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  cases: rows.length,
  schemaPassRate: rows.filter((row) => row.schemaValid).length / rows.length,
  timingPassRate: rows.filter((row) => row.timingValid).length / rows.length,
  assetReferencePassRate: rows.filter((row) => row.unresolvedAssets === 0).length / rows.length,
  averageQaScore: rows.reduce((sum, row) => sum + row.qaScore, 0) / rows.length,
  p95LatencyMs: [...rows].sort((a, b) => a.latencyMs - b.latencyMs)[Math.ceil(rows.length * 0.95) - 1]?.latencyMs ?? 0,
  totalCostUsd: rows.reduce((sum, row) => sum + row.costUsd, 0),
};

await mkdir(resolve("evals/results"), { recursive: true });
await writeFile(resolve("evals/results/latest.json"), JSON.stringify({ summary, rows }, null, 2), "utf8");
await writeFile(resolve("evals/results/latest.md"), `# StoryForge Fixture Eval\n\n| Metric | Result |\n|---|---:|\n| Cases | ${summary.cases} |\n| Schema pass | ${(summary.schemaPassRate * 100).toFixed(0)}% |\n| Timing pass | ${(summary.timingPassRate * 100).toFixed(0)}% |\n| Asset reference pass | ${(summary.assetReferencePassRate * 100).toFixed(0)}% |\n| Average QA | ${summary.averageQaScore.toFixed(1)} |\n| P95 fixture latency | ${summary.p95LatencyMs.toFixed(2)} ms |\n| Fixture cost | $${summary.totalCostUsd.toFixed(2)} |\n`, "utf8");
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
