import { test, expect, chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../..");

const TCO = "https://t.co/card";
const EXPANDED = "https://example.com/article";

// Served offline. The slow script keeps the document from reaching document_idle
// until after the GraphQL response has arrived, which is the case under test.
const PAGE = `<!DOCTYPE html>
<html>
  <head>
    <script>
      window.apiDone = fetch("/i/api/graphql/abc/TweetDetail").then((r) => r.json());
    </script>
    <script src="/slow.js"></script>
  </head>
  <body><a id="card" href="${TCO}">example.com</a></body>
</html>`;

test("resolves card links from responses received before document_idle", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-ext-"));
  const context = await chromium.launchPersistentContext(tmpDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    await context.route("https://x.com/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/slow.js") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return route.fulfill({ contentType: "text/javascript", body: "" });
      }
      if (pathname.includes("/graphql/")) {
        return route.fulfill({ json: { url: TCO, expanded_url: EXPANDED } });
      }
      return route.fulfill({ contentType: "text/html", body: PAGE });
    });

    const page = await context.newPage();
    await page.goto("https://x.com/test");

    await expect(page.locator("#card")).toHaveAttribute("href", EXPANDED, {
      timeout: 5000,
    });
  } finally {
    await context.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
