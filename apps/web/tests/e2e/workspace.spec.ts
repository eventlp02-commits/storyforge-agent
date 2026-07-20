import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("replays the no-key demo and exposes linked production artifacts", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { name: "星脉之歌", level: 1 })).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await expect(page.getByText("已完成", { exact: true })).toBeVisible({ timeout: 10_000 });
  } else {
    await expect(page.getByText("完整制作包已就绪")).toBeVisible({ timeout: 10_000 });
  }
  await page.getByRole("tab", { name: "镜头时间线" }).click();
  await expect(page.getByText("维尔塔拉云海")).toBeVisible();
  await page.getByRole("tab", { name: "资产" }).click();
  await expect(page.getByRole("button", { name: /卢米拉人类首都/ })).toBeVisible();
});

test("creates a one-sentence local project and restores it after refresh", async ({ page }) => {
  const prompt = "一名修钟匠发现整座城市的时间正在倒流";
  await page.getByLabel("一句话视频创意").fill(prompt);
  await page.getByRole("button", { name: "开始创作" }).click();
  await expect(page.getByText(prompt)).toBeVisible();
  await page.reload();
  await expect(page.getByText(prompt)).toBeVisible();
});

test("exports the complete production package", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Download is covered on desktop");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /导出制作包/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("StoryForge制作包.zip");
});

test("keeps the mobile workspace inside the viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout check");
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  await expect(page.getByRole("tab", { name: "创意简报" })).toBeVisible();
});
