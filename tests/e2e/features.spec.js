import { test, expect, chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../..");

const API_RESPONSE = {
  url: "https://t.co/card",
  expanded_url: "https://github.com/user-cube/url-cleaner?fbclid=abc",
};

// Served offline: one inline link, one card link and one link with no known destination
const PAGE = `<!DOCTYPE html>
<html>
  <head>
    <script>fetch("/i/api/graphql/abc/TweetDetail");</script>
    <script src="/slow.js"></script>
  </head>
  <body>
    <a id="inline" href="https://t.co/inline">https://example.com/article?utm_source=x&amp;id=1</a>
    <a id="card" href="https://t.co/card">GitHub card</a>
    <a id="missing" href="https://t.co/missing">Mystery link</a>
  </body>
</html>`;

// Two rows with long and short paths, for reviewing the popup layout
const POPUP_DATA = {
  links: [
    { tco: "https://t.co/inline", expanded: "https://www.example.com/articles/2026/a-rather-long-article-title?id=1", trackingRemoved: true },
    { tco: "https://t.co/card", expanded: "https://github.com/user-cube/url-cleaner", trackingRemoved: false },
    { tco: "https://t.co/home", expanded: "https://example.org/", trackingRemoved: false },
  ],
  unresolved: 1,
};

let context;
let extensionId;
let tmpDir;
let tcoRequests;

test.beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-ext-"));
  context = await chromium.launchPersistentContext(tmpDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  await context.route("https://x.com/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/slow.js") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return route.fulfill({ contentType: "text/javascript", body: "" });
    }
    if (pathname.includes("/graphql/")) return route.fulfill({ json: API_RESPONSE });
    return route.fulfill({ contentType: "text/html", body: PAGE });
  });
  await context.route("https://t.co/**", (route) => {
    tcoRequests.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "t.co" });
  });

  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
});

test.beforeEach(() => {
  tcoRequests = [];
});

test.afterAll(async () => {
  await context.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function setSettings(values) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate((v) => chrome.storage.sync.clear().then(() => chrome.storage.sync.set(v)), values);
  await page.close();
}

async function openX() {
  const page = await context.newPage();
  await page.goto("https://x.com/test");
  await expect(page.locator("#card")).toHaveAttribute("data-url-cleaner-done", "1");
  return page;
}

test("removes tracking parameters from inline and card links", async () => {
  await setSettings({});
  const page = await openX();

  await expect(page.locator("#inline")).toHaveAttribute("href", "https://example.com/article?id=1");
  await expect(page.locator("#card")).toHaveAttribute("href", "https://github.com/user-cube/url-cleaner");
  await expect(page.locator("#card")).toHaveAttribute("title", /was https:\/\/t\.co\/card/);
  await page.close();
});

test("options turn off tracking removal, tooltip and the warning", async () => {
  await setSettings({ stripTracking: false, showTooltip: false, warnUnresolved: false });
  const page = await openX();

  await expect(page.locator("#card")).toHaveAttribute("href", API_RESPONSE.expanded_url);
  await expect(page.locator("#card")).not.toHaveAttribute("title", /.*/);

  const popup = context.waitForEvent("page", { timeout: 2000 }).catch(() => null);
  await page.locator("#missing").click();
  await page.waitForURL("https://t.co/missing");
  await popup;
  expect(tcoRequests).toContain("https://t.co/missing");
  await page.close();
});

test("asks before opening an unresolved link", async () => {
  await setSettings({});
  const page = await openX();

  await page.locator("#missing").click();

  const warning = page.locator("#url-cleaner-warning");
  await expect(warning.getByText("This link is not resolved yet")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("warning.png") });
  expect(page.url()).toBe("https://x.com/test");
  expect(tcoRequests).toEqual([]);

  const [opened] = await Promise.all([
    context.waitForEvent("page"),
    warning.getByRole("button", { name: "Open via t.co" }).click(),
  ]);
  await expect(warning).toHaveCount(0);
  await opened.close();
  expect(tcoRequests).toEqual(["https://t.co/missing"]);
  await page.close();
});

test("the content script reports links and unresolved count to the popup", async () => {
  await setSettings({});
  const page = await openX();
  const extensionPage = await context.newPage();
  await extensionPage.goto(`chrome-extension://${extensionId}/options.html`);

  const response = await extensionPage.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "https://x.com/*" });
    return chrome.tabs.sendMessage(tab.id, { type: "GET_RESOLVED" });
  });

  expect(response.unresolved).toBe(1);
  expect(response.links).toContainEqual({
    tco: "https://t.co/card",
    expanded: "https://github.com/user-cube/url-cleaner",
    trackingRemoved: true,
  });
  await extensionPage.close();
  await page.close();
});

test("options page saves changes", async () => {
  await setSettings({});
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  const toggle = page.getByRole("checkbox", { name: /Remove tracking parameters/ });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.getByRole("status")).toHaveText("Saved. Reload X to apply it.");

  await page.reload();
  await expect(toggle).not.toBeChecked();
  await page.screenshot({ path: test.info().outputPath("options.png") });
  await page.close();
});

for (const colorScheme of ["light", "dark"]) {
  test(`popup lists and copies links in ${colorScheme} mode`, async () => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 360, height: 420 });
    await page.emulateMedia({ colorScheme });
    await page.addInitScript((data) => {
      chrome.tabs.query = (_query, callback) => callback([{ id: 1 }]);
      chrome.tabs.sendMessage = (_id, _message, callback) => callback(data);
      // Records each copy, then lets the real clipboard write run
      const writeText = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (text) => {
        window.copiedText = text;
        return writeText(text);
      };
    }, POPUP_DATA);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator("#count")).toHaveText("3");
    await expect(page.locator(".host").first()).toHaveText("example.com");
    await expect(page.locator(".cleaned:visible")).toHaveCount(1);
    await expect(page.locator("#unresolved")).toHaveText("1 link is not resolved yet.");
    await page.screenshot({ path: test.info().outputPath(`popup-${colorScheme}.png`) });

    const copyLink = page.locator(".copy").first();
    await copyLink.click();
    await expect(copyLink).toHaveClass(/done/);
    expect(await page.evaluate(() => window.copiedText)).toBe(POPUP_DATA.links[0].expanded);

    await page.getByRole("button", { name: "Copy all" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => window.copiedText)).toBe(
      POPUP_DATA.links.map((link) => link.expanded).join("\n"),
    );
    await page.close();
  });
}
