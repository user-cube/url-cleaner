// Rewrites t.co hrefs in the DOM using:
// 1. Visible text in the anchor (for inline tweet links)
// 2. Mappings from intercept.js via CustomEvents (for card links)

// Track all resolved links for the popup: tco -> expanded
const resolvedMap = new Map();

// Mirror of the MAIN world map, populated via CustomEvents from intercept.js
const isoMap = new Map();

function updateBadge() {
  chrome.runtime.sendMessage({ type: "UPDATE_BADGE", count: resolvedMap.size }, () => {
    void chrome.runtime.lastError;
  });
}

function extractUrlFromText(a) {
  const text = a.innerText.trim().replace(/\u2026$/, "");
  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }
  return null;
}

function markResolved(a, tco, expanded) {
  a.setAttribute("href", expanded);
  a.dataset.urlCleanerDone = "1";
  // Tooltip: show original t.co + destination on hover
  a.setAttribute("title", `🔗 ${expanded}\n(was ${tco})`);
  resolvedMap.set(tco, expanded);
  updateBadge();
}

function rewriteAnchor(a) {
  if (!a.href.startsWith("https://t.co/")) return;
  if (a.dataset.urlCleanerDone === "1") return;

  const tco = a.getAttribute("href");

  // Try visible text first (inline tweet links)
  const fromText = extractUrlFromText(a);
  if (fromText) {
    markResolved(a, tco, fromText);
    return;
  }

  // Try the isolated-world copy of the map
  const fromMap = isoMap.get(tco);
  if (fromMap) {
    markResolved(a, tco, fromMap);
    return;
  }

  // Mark as pending — will be rewritten when intercept.js fires the event
  a.dataset.urlCleanerDone = "pending";
}

function rewriteAnchors(root) {
  const anchors = root.querySelectorAll ? root.querySelectorAll("a[href]") : [];
  for (const a of anchors) rewriteAnchor(a);
}

// Listen for mappings discovered by intercept.js (MAIN world -> isolated world via CustomEvent)
window.addEventListener("__urlCleanerUpdate", (e) => {
  const { tco, expanded } = e.detail;
  isoMap.set(tco, expanded);
  for (const a of document.querySelectorAll(`a[href="${CSS.escape(tco)}"], a[data-url-cleaner-done="pending"][href="${CSS.escape(tco)}"]`)) {
    markResolved(a, tco, expanded);
  }
});

// Respond to popup requesting the list of resolved links
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_RESOLVED") {
    sendResponse(Array.from(resolvedMap.entries()).map(([tco, expanded]) => ({ tco, expanded })));
  }
});

// Inject CSS for resolved link indicator
const style = document.createElement("style");
style.textContent = `
  a[data-url-cleaner-done="1"]::after {
    content: " ✓";
    font-size: 0.75em;
    color: #1d9bf0;
    opacity: 0.7;
    pointer-events: none;
  }
`;
(document.head || document.documentElement).appendChild(style);

rewriteAnchors(document);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      rewriteAnchors(node);
    }
  }
});

const observeTarget = document.body || document.documentElement;
if (observeTarget) {
  observer.observe(observeTarget, { childList: true, subtree: true });
} else {
  new MutationObserver((_, obs) => {
    if (document.body) {
      obs.disconnect();
      observer.observe(document.body, { childList: true, subtree: true });
      rewriteAnchors(document.body);
    }
  }).observe(document.documentElement, { childList: true });
}
