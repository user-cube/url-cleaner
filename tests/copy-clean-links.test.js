import { readFileSync } from "fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const runScripts = (...files) =>
  new Function(files.map((file) => readFileSync(file, "utf-8")).join("\n"))();

const EXPANDED =
  "https://editorial.rottentomatoes.com/article/renewed-and-cancelled-tv-shows-2026/?cmp=TWRT_Edit_Renewed_SlowHorses";

// Markup X uses for a truncated link: hidden scheme, visible part, hidden tail, ellipsis
const TWEET = `
  <article>
    <div data-testid="tweetText">
      <span>Which shows are coming back? </span><a dir="ltr" href="https://t.co/abc123" role="link"><span aria-hidden="true" class="r-u8s1d">https://</span>editorial.rottentomatoes.com/article/renewe<span aria-hidden="true" class="r-u8s1d">d-and-cancelled-tv-shows-2026/?cmp=TWRT_Edit_Renewed_SlowHorses</span><span aria-hidden="true" class="r-lrvibr">…</span></a><span> and more</span>
    </div>
  </article>`;

beforeEach(() => {
  vi.stubGlobal("chrome", {
    runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn() } },
    storage: { sync: { get: (defaults, callback) => callback(defaults) } },
  });
  vi.stubGlobal("CSS", { escape: (value) => value.replace(/[^\w-]/g, "\\$&") });
  document.body.innerHTML = TWEET;
  const link = document.querySelector("a");
  // jsdom has no layout, so give the anchor the text the browser would render
  Object.defineProperty(link, "innerText", {
    get: () => "editorial.rottentomatoes.com/article/renewe…",
  });
  // innerText alone is not a full URL, so resolve it through intercept.js' event
  runScripts("lib/settings.js", "lib/strip-tracking.js", "lib/unresolved-warning.js", "content.js");
  window.dispatchEvent(
    new CustomEvent("__urlCleanerUpdate", { detail: { tco: "https://t.co/abc123", expanded: EXPANDED } }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.getSelection().removeAllRanges();
  document.body.innerHTML = "";
});

function select(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
}

function copy() {
  const data = {};
  const event = new Event("copy", { bubbles: true, cancelable: true });
  event.clipboardData = { setData: (type, value) => (data[type] = value) };
  document.dispatchEvent(event);
  return { data, prevented: event.defaultPrevented };
}

test("copies a truncated link as its clean URL on one line", () => {
  select(document.querySelector('[data-testid="tweetText"]'));
  // What Chrome puts on the clipboard for X's split link spans
  vi.spyOn(window.getSelection(), "toString").mockReturnValue(
    "Which shows are coming back? https://\neditorial.rottentomatoes.com/article/renewe\nd-and-cancelled-tv-shows-2026/?cmp=TWRT_Edit_Renewed_SlowHorses and more",
  );

  const { data, prevented } = copy();

  const clean = EXPANDED;
  expect(prevented).toBe(true);
  expect(data["text/plain"]).toBe(`Which shows are coming back? ${clean} and more`);
  expect(data["text/html"]).toContain(`>${clean}</a>`);
});

test("also matches when the hidden ellipsis pieces are copied", () => {
  select(document.querySelector('[data-testid="tweetText"]'));

  const { data, prevented } = copy();

  expect(prevented).toBe(true);
  expect(data["text/plain"].trim()).toBe(`Which shows are coming back? ${EXPANDED} and more`);
});

test("cleans a link selected on its own, from inside the anchor", () => {
  const link = document.querySelector("a");
  const range = document.createRange();
  range.setStart(link.querySelector("span").firstChild, 0);
  const tail = link.querySelectorAll("span")[1].firstChild;
  range.setEnd(tail, tail.length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  // Firefox's selection.toString() joins the pieces even though its clipboard
  // serializer splits them
  vi.spyOn(window.getSelection(), "toString").mockReturnValue(
    "https://editorial.rottentomatoes.com/article/renewed-and-cancelled-tv-shows-2026/?cmp=TWRT_Edit_Renewed_SlowHorses",
  );

  const { data, prevented } = copy();

  expect(prevented).toBe(true);
  expect(data["text/plain"]).toBe(EXPANDED);
});

test("leaves the copy alone when the link is only partly selected", () => {
  const range = document.createRange();
  const visible = document.querySelector("a").childNodes[1];
  range.setStart(visible, 0);
  range.setEnd(visible, 11);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);

  const { data, prevented } = copy();

  expect(prevented).toBe(false);
  expect(data).toEqual({});
});
