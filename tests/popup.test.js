import { readFileSync } from "fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const html = readFileSync("popup.html", "utf-8");
const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("<script"));

const link = (id) => ({ tco: `https://t.co/${id}`, expanded: `https://example.com/${id}`, trackingRemoved: false });

let response;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = body;
  response = { links: [link("a")], unresolved: 1 };
  vi.stubGlobal("chrome", {
    runtime: { lastError: undefined, openOptionsPage: vi.fn() },
    tabs: {
      query: (_query, callback) => callback([{ id: 1 }]),
      sendMessage: (_id, _message, callback) => callback(structuredClone(response)),
    },
  });
  new Function(readFileSync("popup.js", "utf-8"))();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const hosts = () => [...document.querySelectorAll("#list .path")].map((el) => el.textContent);

test("adds links resolved while the popup is open", () => {
  expect(hosts()).toEqual(["/a"]);
  expect(document.getElementById("count").textContent).toBe("1");

  response = { links: [link("a"), link("b")], unresolved: 0 };
  vi.advanceTimersByTime(500);

  expect(hosts()).toEqual(["/a", "/b"]);
  expect(document.getElementById("count").textContent).toBe("2");
  expect(document.getElementById("unresolved").hidden).toBe(true);
});

test("keeps rows already shown, with their copied state", () => {
  const first = document.querySelector("#list li");
  first.querySelector(".copy").classList.add("done");

  response = { links: [link("a"), link("b")], unresolved: 0 };
  vi.advanceTimersByTime(500);

  expect(document.querySelector("#list li")).toBe(first);
  expect(first.querySelector(".copy").classList.contains("done")).toBe(true);
});

test("copies every link shown at the time of the click", async () => {
  const writeText = vi.fn();
  vi.stubGlobal("navigator", { clipboard: { writeText } });

  response = { links: [link("a"), link("b")], unresolved: 0 };
  vi.advanceTimersByTime(500);
  await document.getElementById("copy-all").click();

  expect(writeText).toHaveBeenCalledWith("https://example.com/a\nhttps://example.com/b");
});

test("shows the empty state when the links go away", () => {
  response = { links: [], unresolved: 0 };
  vi.advanceTimersByTime(500);

  expect(document.getElementById("list").hidden).toBe(true);
  expect(document.getElementById("copy-all").hidden).toBe(true);
  expect(document.getElementById("empty").hidden).toBe(false);
});
