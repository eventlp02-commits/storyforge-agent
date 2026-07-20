import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_storyforge_local",
  runtime: "node-22",
  dirs: ["./trigger/tasks"],
  maxDuration: 3600,
  build: {
    external: ["sharp"],
  },
});
