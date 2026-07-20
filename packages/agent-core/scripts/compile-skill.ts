import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, "../../../skills/short-drama-creation-master");
const outputFile = resolve(here, "../src/generated/skill-bundle.ts");

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return /\.(md|ya?ml)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat().sort();
}

const files = await collectFiles(skillRoot);
const sections = await Promise.all(files.map(async (file) => {
  const content = await readFile(file, "utf8");
  const relative = file.slice(skillRoot.length + 1);
  return `## SOURCE: ${relative}\n\n${content.trim()}`;
}));
const content = sections.join("\n\n");
const hash = createHash("sha256").update(content).digest("hex");
const generated = `// Generated from skills/short-drama-creation-master. Do not edit.\nexport const promptBundle = ${JSON.stringify({ version: `sha256:${hash}`, hash, content }, null, 2)} as const;\n`;
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, generated, "utf8");
process.stdout.write(`Compiled ${files.length} skill files as sha256:${hash.slice(0, 12)}\n`);
