import { readFileSync } from "fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const runScripts = (...files) =>
  new Function(files.map((file) => readFileSync(file, "utf-8")).join("\n"))();

const TCO = "https://t.co/card";
const EXPANDED = "https://example.com/article";

const originalFetch = window.fetch;
const originalXHR = window.XMLHttpRequest;

beforeEach(() => {
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
    },
    storage: {
      sync: { get: (defaults, callback) => callback(defaults) },
    },
  });
  vi.stubGlobal("CSS", { escape: (value) => value.replace(/[^\w-]/g, "\\$&") });
  window.fetch = vi.fn(async () => Response.json({ url: TCO, expanded_url: EXPANDED }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.fetch = originalFetch;
  window.XMLHttpRequest = originalXHR;
  delete window.__urlCleanerMap;
  document.body.innerHTML = "";
});

test("resolves card links from responses received before content.js starts", async () => {
  runScripts("intercept.js");
  const response = await window.fetch("https://x.com/i/api/graphql/abc/TweetDetail");
  await response.clone().json();
  await new Promise((resolve) => setTimeout(resolve));

  const card = document.createElement("a");
  card.href = TCO;
  card.innerText = "example.com";
  document.body.appendChild(card);

  runScripts(
    "lib/settings.js",
    "lib/strip-tracking.js",
    "lib/unresolved-warning.js",
    "content.js",
  );

  expect(card.getAttribute("href")).toBe(EXPANDED);
  expect(card.dataset.urlCleanerDone).toBe("1");
});
