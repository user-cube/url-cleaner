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

function render({ links, unresolved }) {
  if (unresolved > 0) {
    $("unresolved").textContent = unresolved === 1
      ? "1 link is not resolved yet."
      : `${unresolved} links are not resolved yet.`;
    $("unresolved").hidden = false;
  }

  if (links.length === 0) {
    $("empty").textContent = NO_LINKS;
    return;
  }

  $("empty").hidden = true;
  $("count").textContent = links.length;
  $("count").hidden = false;
  $("list").append(...links.map(renderRow));
  $("list").hidden = false;

  const copyAll = $("copy-all");
  copyAll.hidden = false;
  copyAll.addEventListener("click", async () => {
    await navigator.clipboard.writeText(links.map((link) => link.expanded).join("\n"));
    copyAll.textContent = "Copied";
    setTimeout(() => { copyAll.textContent = "Copy all"; }, FEEDBACK_MS);
  });
}

$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("empty").textContent = NOT_ON_X;

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "GET_RESOLVED" }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    render(response);
  });
});
