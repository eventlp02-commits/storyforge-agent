import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { starveinDemo } from "./demo-project";
import { buildProjectArchiveBytes, buildTextExports, csvEscape } from "./export-package";

describe("production package export", () => {
  it("contains every required production file", () => {
    const files = buildTextExports(starveinDemo);
    expect(Object.keys(files)).toEqual(expect.arrayContaining([
      "项目简报.md",
      "完整剧本.md",
      "镜头时间线.csv",
      "资产清单.csv",
      "生成提示词.md",
      "QA报告.md",
      "project.json",
    ]));
  });

  it("escapes commas, quotes and newlines in CSV", () => {
    expect(csvEscape("a,b\n\"c\"")).toBe('"a,b\n""c"""');
  });

  it("embeds a CJK-capable font in the Word style sheet", async () => {
    const archive = await JSZip.loadAsync(await buildProjectArchiveBytes(starveinDemo));
    const docxBytes = await archive.file("StoryForge_制作包.docx")?.async("uint8array");
    expect(docxBytes).toBeDefined();
    const docx = await JSZip.loadAsync(docxBytes!);
    const styles = await docx.file("word/styles.xml")?.async("string");
    expect(styles).toContain("Arial Unicode MS");
  });
});
