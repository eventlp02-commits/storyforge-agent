import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promptBundle } from "../src/generated/skill-bundle";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, "../../../skills/short-drama-creation-master");

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(path);
    return /\.(md|ya?ml)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat().sort();
}

const skill = await readFile(resolve(skillRoot, "SKILL.md"), "utf8");
if (!/^---\nname: short-drama-creation-master\ndescription: .+\n---\n/.test(skill)) {
  throw new Error("SKILL.md frontmatter is missing the stable name or description");
}
const agentManifest = await readFile(resolve(skillRoot, "agents/openai.yaml"), "utf8");
if (!agentManifest.includes("display_name:") || !agentManifest.includes("short_description:")) {
  throw new Error("agents/openai.yaml is missing required presentation metadata");
}
const files = await collectFiles(skillRoot);
const sections = await Promise.all(files.map(async (file) => {
  const content = await readFile(file, "utf8");
  return `## SOURCE: ${file.slice(skillRoot.length + 1)}\n\n${content.trim()}`;
}));
const hash = createHash("sha256").update(sections.join("\n\n")).digest("hex");
if (hash !== promptBundle.hash) {
  throw new Error("Prompt Bundle is stale; run pnpm skill:compile and commit the generated bundle");
}
process.stdout.write(`Skill valid: ${files.length} sources, sha256:${hash.slice(0, 12)}\n`);
