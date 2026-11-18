import { readFileSync } from "fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const runScripts = (...files) =>
  new Function(files.map((file) => readFileSync(file, "utf-8")).join("\n"))();

const post = (id) => `<article><a href="https://t.co/${id}">https://example.com/${id}</a></article>`;

let onMessage;
let observers;

beforeEach(() => {
  history.replaceState(null, "", "/home");
  // Each test starts its own content script; stop the previous ones from
  // marking this test's links
  observers = [];
  const Observer = MutationObserver;
  vi.stubGlobal("MutationObserver", class extends Observer {
    constructor(callback) {
      super(callback);
      observers.push(this);
    }
  });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage: vi.fn(), onMessage: { addListener: (listener) => { onMessage = listener; } } },
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
  for (const observer of observers) observer.disconnect();
  vi.unstubAllGlobals();
  delete HTMLElement.prototype.innerText;
  document.body.innerHTML = "";
});

const start = () =>
  runScripts("lib/settings.js", "lib/strip-tracking.js", "lib/unresolved-warning.js", "content.js");

const popupLinks = () => {
  let response;
  onMessage({ type: "GET_RESOLVED" }, {}, (value) => { response = value; });
  return response.links.map((link) => link.expanded);
};

// X swaps the page content without reloading
const navigate = async (path, html) => {
  history.pushState(null, "", path);
  document.body.innerHTML = html;
  await new Promise((resolve) => setTimeout(resolve));
};

test("lists only the links of the page navigated to", async () => {
  document.body.innerHTML = post("aaa");
  start();
  expect(popupLinks()).toEqual(["https://example.com/aaa"]);

  await navigate("/someone/status/1", post("bbb"));

  expect(popupLinks()).toEqual(["https://example.com/bbb"]);
});

test("lists links already resolved that are back on screen", async () => {
  const timeline = post("aaa");
  document.body.innerHTML = timeline;
  start();
  const resolvedTimeline = document.body.innerHTML;

  await navigate("/someone/status/1", post("bbb"));
  // Going back restores the timeline with its links already rewritten
  await navigate("/home", resolvedTimeline);

  expect(popupLinks()).toEqual(["https://example.com/aaa"]);
});

test("keeps links scrolled off screen on the same page", async () => {
  document.body.innerHTML = post("aaa");
  start();

  // X removes posts that scroll out of view
  document.body.innerHTML = post("bbb");
  await new Promise((resolve) => setTimeout(resolve));

  expect(popupLinks()).toEqual(["https://example.com/aaa", "https://example.com/bbb"]);
});

test("updates the badge to the page's links after navigating", async () => {
  document.body.innerHTML = post("aaa") + post("ccc");
  start();

  await navigate("/someone/status/1", post("bbb"));

  const counts = chrome.runtime.sendMessage.mock.calls.map(([message]) => message.count);
  expect(counts.at(-1)).toBe(1);
});
