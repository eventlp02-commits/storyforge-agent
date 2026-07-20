import { promptBundle } from "./generated/skill-bundle";

export function getSkillVersion(): string {
  return promptBundle.version;
}
