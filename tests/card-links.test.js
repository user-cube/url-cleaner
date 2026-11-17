import { readFileSync } from "fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const runScripts = (...files) =>
  new Function(files.map((file) => readFileSync(file, "utf-8")).join("\n"))();

const TCO = "https://t.co/ir73rekSTe";
const EXPANDED = "https://superlogical.com/updates/public-testing-beginning";

// A post whose link appears inline (with the URL as text) and as a card (image
// and "From <domain>"), all three pointing at the same t.co
const INLINE = `<a class="inline" href="${TCO}">${EXPANDED}</a>`;
const CARD = `
  <a class="card-image" href="${TCO}" aria-label="superlogical.com Public testing is beginning"><div></div></a>
  <a class="card-source" href="${TCO}">From superlogical.com</a>`;

beforeEach(() => {
  vi.stubGlobal("chrome", {
    runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn() } },
    storage: { sync: { get: (defaults, callback) => callback(defaults) } },
  });
  vi.stubGlobal("CSS", { escape: (value) => value.replace(/[^\w-]/g, "\\$&") });
  // jsdom has no innerText; without layout, the text content is what a browser renders here
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete HTMLElement.prototype.innerText;
  document.body.innerHTML = "";
});

const start = () =>
  runScripts("lib/settings.js", "lib/strip-tracking.js", "lib/unresolved-warning.js", "content.js");

const states = () =>
  [...document.querySelectorAll("a")].map((a) => [a.className, a.dataset.urlCleanerDone, a.getAttribute("href")]);

test("resolves card links that come before the inline link", () => {
  document.body.innerHTML = `<article>${CARD}<p>${INLINE}</p></article>`;
  start();

  expect(states()).toEqual([
    ["card-image", "1", EXPANDED],
    ["card-source", "1", EXPANDED],
    ["inline", "1", EXPANDED],
  ]);
});

test("resolves card links rendered after the inline link", async () => {
  document.body.innerHTML = `<article><p>${INLINE}</p></article>`;
  start();

  document.querySelector("article").insertAdjacentHTML("beforeend", CARD);
  await new Promise((resolve) => setTimeout(resolve));

  expect(states()).toEqual([
    ["inline", "1", EXPANDED],
    ["card-image", "1", EXPANDED],
    ["card-source", "1", EXPANDED],
  ]);
});

test("keeps a card link pending when no link shows its URL", () => {
  document.body.innerHTML = `<article>${CARD}</article>`;
  start();

  expect(states()).toEqual([
    ["card-image", "pending", TCO],
    ["card-source", "pending", TCO],
  ]);
});
