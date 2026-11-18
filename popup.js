const NOT_ON_X = "Open X or Twitter to see resolved links.";
const NO_LINKS = "No resolved links on this page yet.";
const FEEDBACK_MS = 1500;

const $ = (id) => document.getElementById(id);

function describe(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const path = parsed.pathname + parsed.search + parsed.hash;
    return {
      host: parsed.hostname.replace(/^www\./, ""),
      path: path === "/" ? "" : path,
    };
  } catch {
    return null;
  }
}

function renderRow({ tco, expanded, trackingRemoved }) {
  const row = $("row").content.cloneNode(true);
  const destination = row.querySelector(".destination");
  const parts = describe(expanded);

  // Only http(s) destinations become clickable
  if (parts) {
    destination.href = expanded;
    destination.target = "_blank";
    destination.rel = "noopener";
    destination.title = expanded;
    row.querySelector(".host").textContent = parts.host;
    row.querySelector(".path").textContent = parts.path;
  } else {
    row.querySelector(".host").textContent = expanded;
  }

  row.querySelector(".tco").textContent = tco.replace(/^https:\/\//, "");
  row.querySelector(".cleaned").hidden = !trackingRemoved;

  const copy = row.querySelector(".copy");
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(expanded);
    copy.classList.add("done");
    setTimeout(() => copy.classList.remove("done"), FEEDBACK_MS);
  });
  return row;
}

// Rows by t.co, so a refresh keeps the rows already shown (and their copied state)
const rows = new Map();
let currentLinks = [];
let lastResponse = "";

function render({ links, unresolved }) {
  $("unresolved").textContent = unresolved === 1
    ? "1 link is not resolved yet."
    : `${unresolved} links are not resolved yet.`;
  $("unresolved").hidden = unresolved === 0;

  currentLinks = links;
  const empty = links.length === 0;
  $("empty").textContent = NO_LINKS;
  $("empty").hidden = !empty;
  $("count").textContent = links.length;
  $("count").hidden = empty;
  $("list").hidden = empty;
  $("copy-all").hidden = empty;

  const shown = new Set();
  $("list").replaceChildren(...links.map((link) => {
    const key = `${link.tco} ${link.expanded}`;
    shown.add(key);
    if (!rows.has(key)) rows.set(key, renderRow(link).firstElementChild);
    return rows.get(key);
  }));
  for (const key of rows.keys()) if (!shown.has(key)) rows.delete(key);
}

$("copy-all").addEventListener("click", async () => {
  const copyAll = $("copy-all");
  await navigator.clipboard.writeText(currentLinks.map((link) => link.expanded).join("\n"));
  copyAll.textContent = "Copied";
  setTimeout(() => { copyAll.textContent = "Copy all"; }, FEEDBACK_MS);
});

$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("empty").textContent = NOT_ON_X;

// Links keep resolving while the page scrolls, so ask again while the popup is open
const REFRESH_MS = 500;

function refresh(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "GET_RESOLVED" }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    const serialized = JSON.stringify(response);
    if (serialized === lastResponse) return;
    lastResponse = serialized;
    render(response);
  });
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;
  refresh(tab.id);
  setInterval(() => refresh(tab.id), REFRESH_MS);
});
