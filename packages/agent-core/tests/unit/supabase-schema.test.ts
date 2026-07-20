import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Supabase credential policies", () => {
  it("allows owners to renew an encrypted run credential without exposing other users", () => {
    const migration = readFileSync(new URL("../../../../supabase/migrations/202607200001_storyforge_schema.sql", import.meta.url), "utf8");
    expect(migration).toContain("credentials_owner_select");
    expect(migration).toContain("credentials_owner_update");
    expect(migration).toMatch(/credentials_owner_update[\s\S]+using \(user_id = auth\.uid\(\)\)[\s\S]+with check \(user_id = auth\.uid\(\)\)/);
  });

  it("stores every shot field required by the shared contract", () => {
    const migration = readFileSync(new URL("../../../../supabase/migrations/202607200001_storyforge_schema.sql", import.meta.url), "utf8");
    expect(migration).toMatch(/create table public\.shots \([\s\S]+purpose text not null[\s\S]+generation_status text not null/);
  });
});
