// Generates the store images in docs/store-assets. Screenshots use the real extension.
// The page behind the extension is a local demo feed with example domains.
//
// Screenshots are 1280x800, full bleed. The UI is rendered at 2x so it stays readable
// when the Chrome Web Store downscales screenshots to 640x400.
// The Chrome small promo tile is 440x280, with no text, as Google advises.
//
// Usage: npm run screenshots
// Set CHROMIUM_PATH to use a specific Chromium build.

import { chromium } from "@playwright/test";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "docs/store-assets");

const post = (initial, name, text, link) => `
  <article>
    <span class="avatar">${initial}</span>
    <div>
      <p class="name">${name}</p>
      <p>${text}</p>
      <p>${link}</p>
    </div>
  </article>`;

const FEED = `<!DOCTYPE html>
<html>
  <head>
    <title>Demo feed</title>
    <style>
      :root { color-scheme: light dark; --bg: #fff; --text: #0f1419; --muted: #536471; --border: #e6ecf0; --link: #0b6fbf; }
      @media (prefers-color-scheme: dark) {
        :root { --bg: #15202b; --text: #e7e9ea; --muted: #8b98a5; --border: #2f3b47; --link: #4db5f5; }
      }
      * { box-sizing: border-box; margin: 0; }
      body { background: var(--bg); color: var(--text); font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      article { display: flex; gap: 10px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
      .avatar { display: grid; flex: none; width: 32px; height: 32px; place-items: center; border-radius: 50%; background: var(--border); color: var(--muted); font-weight: 700; }
      .name { font-weight: 700; }
      a { color: var(--link); text-decoration: none; }
    </style>
    <script>fetch("/i/api/graphql/demo/Feed");</script>
    <script src="/slow.js"></script>
  </head>
  <body>
    ${post("A", "Demo Author", "A long read about keeping links private.", '<a href="https://t.co/article">example.com/articles/private-links</a>')}
    ${post("B", "Sample Account", "The release notes are out.", '<a href="https://t.co/notes">Read the release notes</a>')}
    ${post("C", "Test Writer", "Slides from this week's talk.", '<a href="https://t.co/slides">https://example.org/talks/slides</a>')}
    ${post("D", "Example User", "This one has no known destination yet.", '<a id="missing" href="https://t.co/unknown">See the link</a>')}
  </body>
</html>`;

const API_RESPONSE = [
  { url: "https://t.co/article", expanded_url: "https://example.com/articles/private-links?utm_source=feed&id=42" },
  { url: "https://t.co/notes", expanded_url: "https://example.net/releases/notes?fbclid=demo" },
];

const icon = fs
  .readFileSync(path.join(root, "icons/icon.svg"), "utf-8")
  .replace("<svg ", '<svg x="130" y="50" width="180" height="180" ');

// Drawn in 440x280 units. The page renders it at 220x140 and 2x, which gives 440x280.
const PROMO_TILE = `<!DOCTYPE html>
<html>
  <body style="margin:0">
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="140" viewBox="0 0 440 280" style="display:block">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#17364d"/>
          <stop offset="1" stop-color="#15202b"/>
        </linearGradient>
      </defs>
      <rect width="440" height="280" fill="url(#background)"/>
      <g fill="none" stroke="#4db5f5" stroke-opacity="0.22" stroke-width="26">
        <rect x="-110" y="70" width="210" height="140" rx="70"/>
        <rect x="340" y="70" width="210" height="140" rx="70"/>
      </g>
      ${icon}
    </svg>
  </body>
</html>`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "store-screenshots-"));
const context = await chromium.launchPersistentContext(tmpDir, {
  headless: false,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  viewport: { width: 640, height: 400 },
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
});

await context.route("https://x.com/**", async (route) => {
  const { pathname } = new URL(route.request().url());
  if (pathname === "/slow.js") {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return route.fulfill({ contentType: "text/javascript", body: "" });
  }
  if (pathname.includes("/graphql/")) return route.fulfill({ json: API_RESPONSE });
  return route.fulfill({ contentType: "text/html", body: FEED });
});

const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const extensionUrl = `chrome-extension://${new URL(worker.url()).host}`;

async function save(page, name) {
  const file = path.join(outputDir, name);
  await page.screenshot({ path: file });
  // The Chrome Web Store expects PNGs without an alpha channel
  execFileSync("magick", [file, "-alpha", "off", "-define", "png:color-type=2", file]);
  console.log(`Wrote docs/store-assets/${name}`);
}

async function openFeed(colorScheme) {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme });
  await page.goto("https://x.com/demo");
  await page.waitForSelector('a[href^="https://example.net"][data-url-cleaner-done="1"]');
  return page;
}

// Renders the real popup from the content script's real response, then places it
// where the browser shows it. A toolbar popup cannot be captured with the page.
async function showPopup(feed, colorScheme, { copied = false } = {}) {
  const reader = await context.newPage();
  await reader.goto(`${extensionUrl}/options.html`);
  const response = await reader.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "https://x.com/*" });
    return chrome.tabs.sendMessage(tab.id, { type: "GET_RESOLVED" });
  });
  await reader.close();

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 400 });
  await popup.emulateMedia({ colorScheme });
  await popup.addInitScript((data) => {
    chrome.tabs.query = (_query, callback) => callback([{ id: 1 }]);
    chrome.tabs.sendMessage = (_id, _message, callback) => callback(data);
    navigator.clipboard.writeText = async () => {};
  }, response);
  await popup.goto(`${extensionUrl}/popup.html`);
  await popup.waitForSelector("#list li");
  if (copied) {
    await popup.locator(".copy").first().click();
    await popup.mouse.move(0, 0);
    await popup.waitForSelector(".copy.done");
  }
  const image = await popup.locator("body").screenshot();
  await popup.close();

  await feed.evaluate((src) => {
    const img = new Image();
    img.src = src;
    img.style.cssText = "position:fixed;top:8px;right:8px;width:360px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.35)";
    document.body.appendChild(img);
    return img.decode();
  }, `data:image/png;base64,${image.toString("base64")}`);
  await feed.bringToFront();
}

try {
  fs.mkdirSync(outputDir, { recursive: true });

  const feed = await openFeed("light");
  await save(feed, "01-resolved-links.png");
  await showPopup(feed, "light");
  await save(feed, "02-popup-light.png");
  await feed.close();

  const darkFeed = await openFeed("dark");
  await showPopup(darkFeed, "dark", { copied: true });
  await save(darkFeed, "03-popup-dark.png");
  await darkFeed.close();

  const warned = await openFeed("light");
  await warned.locator("#missing").click();
  await warned.getByText("This link is not resolved yet").waitFor();
  await save(warned, "04-unresolved-warning.png");
  await warned.close();

  const options = await context.newPage();
  await options.emulateMedia({ colorScheme: "light" });
  await options.goto(`${extensionUrl}/options.html`);
  await options.waitForSelector("input:checked");
  await save(options, "05-options.png");
  await options.close();

  const promo = await context.newPage();
  await promo.setViewportSize({ width: 220, height: 140 });
  await promo.setContent(PROMO_TILE);
  await save(promo, "promo-small-440x280.png");
  await promo.close();
} finally {
  await context.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
