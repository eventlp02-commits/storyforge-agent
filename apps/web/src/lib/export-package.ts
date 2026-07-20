import JSZip from "jszip";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from "docx";
import type { ProjectSnapshot } from "@storyforge/contracts";

export function csvEscape(value: string | number | undefined): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function briefMarkdown(project: ProjectSnapshot): string {
  return `# ${project.config.title}\n\n## 项目概况\n\n- 创意：${project.config.concept}\n- 时长：${project.config.durationSeconds} 秒\n- 画幅：${project.config.aspectRatio}\n- 类型：${project.config.format}\n- 内容语言：${project.config.contentLanguage}\n- 美术风格：${project.config.visualStyle}\n- Skill 版本：${project.skillVersion}\n\n## Intake Agent 推断\n\n${project.config.assumptions.map((item) => `- ${item}`).join("\n")}\n`;
}

function scriptMarkdown(project: ProjectSnapshot): string {
  return `# ${project.config.title} · 完整剧本\n\n${project.shots.map((shot) => `## ${shot.id}｜${shot.start.toFixed(2)}-${shot.end.toFixed(2)} 秒\n\n**场景与镜头：** ${shot.scene}，${shot.framing}，${shot.camera}\n\n**画面动作：** ${shot.action}\n\n${shot.dialogue ? `**对白/旁白：** ${shot.dialogue}\n\n` : ""}**声音：** ${shot.sound}\n\n**转场：** ${shot.transition}\n`).join("\n")}\n`;
}

function promptMarkdown(project: ProjectSnapshot): string {
  const promptArtifact = project.artifacts.find((artifact) => artifact.type === "prompts");
  const promptContent = promptArtifact?.content as { styleLock?: string } | undefined;
  return `# ${project.config.title} · 生成提示词\n\n## 全局风格锁\n\n${promptContent?.styleLock ?? project.config.visualStyle}\n\n${project.shots.map((shot) => `## ${shot.id}\n\n${shot.prompt}\n\n资产：${shot.assetIds.join("、")}\n`).join("\n")}\n`;
}

function qaMarkdown(project: ProjectSnapshot): string {
  return `# QA 报告\n\n- 总分：${project.qa.score}/100\n- 结果：${project.qa.passed ? "通过" : "未通过"}\n- 自动修复：${project.qa.autoRepairCount} 次\n\n${project.qa.checks.map((check) => `## ${check.label}\n\n- 状态：${check.status}\n- 说明：${check.detail}\n`).join("\n")}\n`;
}

export function buildTextExports(project: ProjectSnapshot): Record<string, string> {
  const shotHeaders = ["镜头ID", "开始秒", "结束秒", "时长秒", "场景", "景别", "机位运动", "动作", "对白", "声音", "转场", "资产编号", "生成状态", "媒体供应商", "供应商任务ID", "媒体文件"];
  const shotRows = project.shots.map((shot) => [
    shot.id,
    shot.start.toFixed(2),
    shot.end.toFixed(2),
    (shot.end - shot.start).toFixed(2),
    shot.scene,
    shot.framing,
    shot.camera,
    shot.action,
    shot.dialogue,
    shot.sound,
    shot.transition,
    shot.assetIds.join("|"),
    shot.generationStatus,
    shot.mediaProvider,
    shot.providerJobId,
    shot.fileUrl,
  ].map(csvEscape).join(","));
  const assetHeaders = ["资产ID", "名称", "类型", "状态", "文件", "关联镜头", "提示词"];
  const assetRows = project.assets.map((asset) => [
    asset.id,
    asset.name,
    asset.type,
    asset.status,
    asset.fileUrl,
    asset.shotIds.join("|"),
    asset.prompt,
  ].map(csvEscape).join(","));

  return {
    "项目简报.md": briefMarkdown(project),
    "完整剧本.md": scriptMarkdown(project),
    "镜头时间线.csv": `\uFEFF${shotHeaders.join(",")}\n${shotRows.join("\n")}\n`,
    "资产清单.csv": `\uFEFF${assetHeaders.join(",")}\n${assetRows.join("\n")}\n`,
    "生成提示词.md": promptMarkdown(project),
    "QA报告.md": qaMarkdown(project),
    "project.json": JSON.stringify(project, null, 2),
  };
}

function productionDoc(project: ProjectSnapshot): Document {
  const font = "Arial Unicode MS";
  const tableWidths = [1200, 1400, 4800, 1960];
  const tableMargins = { marginUnitType: WidthType.DXA, top: 80, bottom: 80, left: 120, right: 120 };
  const tableBorder = { style: BorderStyle.SINGLE, size: 4, color: "CBD5DF" };
  const tableCell = (text: string, width: number, header = false) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: tableMargins,
    verticalAlign: VerticalAlignTable.CENTER,
    ...(header ? { shading: { type: ShadingType.CLEAR, fill: "E8EEF5", color: "auto" } } : {}),
    children: [new Paragraph({ text, style: header ? "SFTableHeader" : "SFTable" })],
  });
  const shotRows = project.shots.map((shot) => new TableRow({
    cantSplit: true,
    children: [
      tableCell(shot.id, tableWidths[0]),
      tableCell(`${shot.start.toFixed(1)}-${shot.end.toFixed(1)}s`, tableWidths[1]),
      tableCell(`${shot.scene}；${shot.action}`, tableWidths[2]),
      tableCell(shot.assetIds.join("、"), tableWidths[3]),
    ],
  }));

  return new Document({
    styles: {
      default: {
        document: {
          run: { font, size: 21, color: "1F2933" },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: "SFTitle",
          name: "StoryForge Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font, bold: true, size: 48, color: "162B3A" },
          paragraph: { spacing: { before: 0, after: 80 }, keepNext: true },
        },
        {
          id: "SFSubtitle",
          name: "StoryForge Subtitle",
          basedOn: "Normal",
          next: "Normal",
          run: { font, size: 21, color: "5C6B76" },
          paragraph: { spacing: { before: 0, after: 240 } },
        },
        {
          id: "SFHeading1",
          name: "StoryForge Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font, bold: true, size: 32, color: "2E74B5" },
          paragraph: { spacing: { before: 360, after: 200 }, keepNext: true },
        },
        {
          id: "SFMeta",
          name: "StoryForge Metadata",
          basedOn: "Normal",
          next: "Normal",
          run: { font, size: 20, color: "334E68" },
          paragraph: { spacing: { before: 0, after: 80, line: 280 } },
        },
        {
          id: "SFTable",
          name: "StoryForge Table Body",
          basedOn: "Normal",
          next: "Normal",
          run: { font, size: 18, color: "1F2933" },
          paragraph: { spacing: { before: 0, after: 0, line: 264 } },
        },
        {
          id: "SFTableHeader",
          name: "StoryForge Table Header",
          basedOn: "SFTable",
          next: "SFTable",
          run: { font, bold: true, size: 18, color: "16324F" },
          paragraph: { spacing: { before: 0, after: 0, line: 264 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          children: [new TextRun({ text: "STORYFORGE AGENT · 制作参考", font, size: 17, color: "718096" })],
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: "StoryForge Agent  ·  ", font, size: 17, color: "718096" }),
            new TextRun({ children: [PageNumber.CURRENT], font, size: 17, color: "718096" }),
          ],
        })] }),
      },
      children: [
        new Paragraph({ text: project.config.title, style: "SFTitle" }),
        new Paragraph({ text: "StoryForge Agent｜完整视频制作包", style: "SFSubtitle" }),
        new Paragraph({ text: `创意：${project.config.concept}`, style: "SFMeta" }),
        new Paragraph({ text: `时长：${project.config.durationSeconds} 秒　画幅：${project.config.aspectRatio}　镜头：${project.shots.length} 个　资产：${project.assets.length} 项`, style: "SFMeta" }),
        new Paragraph({ text: `内容语言：${project.config.contentLanguage}　Skill：${project.skillVersion}`, style: "SFMeta" }),
        new Paragraph({ text: "创作假设", style: "SFHeading1", heading: HeadingLevel.HEADING_1 }),
        ...project.config.assumptions.map((assumption) => new Paragraph({
          text: assumption,
          bullet: { level: 0 },
          indent: { left: 540, hanging: 270 },
          spacing: { after: 80, line: 300 },
        })),
        new Paragraph({ text: "镜头时间线", style: "SFHeading1", heading: HeadingLevel.HEADING_1 }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          indent: { size: 120, type: WidthType.DXA },
          columnWidths: tableWidths,
          layout: TableLayoutType.FIXED,
          margins: tableMargins,
          borders: {
            top: tableBorder,
            bottom: tableBorder,
            left: tableBorder,
            right: tableBorder,
            insideHorizontal: tableBorder,
            insideVertical: tableBorder,
          },
          rows: [new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
              tableCell("镜头", tableWidths[0], true),
              tableCell("时间", tableWidths[1], true),
              tableCell("画面", tableWidths[2], true),
              tableCell("资产", tableWidths[3], true),
            ],
          }), ...shotRows],
        }),
        new Paragraph({ text: "质量检查", style: "SFHeading1", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `综合得分：${project.qa.score}/100　结果：${project.qa.passed ? "通过" : "未通过"}`, style: "SFMeta" }),
        ...project.qa.checks.map((check) => new Paragraph({
          text: `${check.label}：${check.detail}`,
          bullet: { level: 0 },
          indent: { left: 540, hanging: 270 },
          spacing: { after: 80, line: 300 },
        })),
      ],
    }],
  });
}

export async function downloadProjectPackage(project: ProjectSnapshot): Promise<void> {
  const archiveBytes = await buildProjectArchiveBytes(project);
  const archive = new Blob([toArrayBuffer(archiveBytes)], { type: "application/zip" });
  const url = URL.createObjectURL(archive);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.config.title.replace(/[\\/:*?"<>|]/g, "_")}_StoryForge制作包.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function buildProjectArchiveBytes(project: ProjectSnapshot): Promise<Uint8Array> {
  const zip = new JSZip();
  const textFiles = buildTextExports(project);
  for (const [name, content] of Object.entries(textFiles)) zip.file(name, content);
  const docxBlob = await Packer.toBlob(productionDoc(project));
  zip.file("StoryForge_制作包.docx", new Uint8Array(await docxBlob.arrayBuffer()));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
