import { test, expect, chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../..");

// Real tweets known to contain t.co links
const TWEET_URLS = [
  "https://x.com/argoproj/status/2034282659115888887",
  "https://x.com/argoproj/status/2031202381749203320",
];

test.describe("URL Cleaner extension", () => {
  let context;
  let tmpDir;

  test.beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-ext-"));
    context = await chromium.launchPersistentContext(tmpDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const tweetUrl of TWEET_URLS) {
    test(`resolves t.co links on ${tweetUrl}`, async () => {
      const page = await context.newPage();
      await page.goto(tweetUrl, { waitUntil: "domcontentloaded" });

      await expect(page.locator('a[data-url-cleaner-done="1"]').first()).toBeAttached({
        timeout: 15000,
      });

      const resolved = await page
        .locator('a[data-url-cleaner-done="1"]')
        .evaluateAll((els) => els.map((a) => ({
          href: a.getAttribute("href"),
          title: a.getAttribute("title"),
        })));

      expect(resolved.length).toBeGreaterThan(0);

      for (const { href, title } of resolved) {
        // href should no longer be a t.co link
        expect(href).not.toMatch(/^https?:\/\/t\.co\//);
        // tooltip should reference the original t.co URL
        expect(title).toMatch(/t\.co/);
      }
    });
  }
});
