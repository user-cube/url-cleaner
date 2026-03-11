// Runs in MAIN world at document_start — has access to the real window.fetch and XHR.
// Intercepts Twitter's GraphQL responses to extract t.co -> expanded_url mappings.

window.__urlCleanerMap = window.__urlCleanerMap || {};

// Intercept fetch
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");

  if (url.includes("/graphql/") || url.includes("/api/")) {
    try {
      const clone = response.clone();
      clone.json().then(walkAndExtract).catch(() => {});
    } catch {}
  }
  return response;
};

// Intercept XHR (Twitter SPA navigation may use XHR)
const OriginalXHR = window.XMLHttpRequest;
function InterceptedXHR() {
  const xhr = new OriginalXHR();
  const originalOpen = xhr.open.bind(xhr);
  let _url = "";
  xhr.open = function (method, url, ...rest) {
    _url = url;
    return originalOpen(method, url, ...rest);
  };
  xhr.addEventListener("load", function () {
    if (_url.includes("/graphql/") || _url.includes("/api/")) {
      try {
        walkAndExtract(JSON.parse(xhr.responseText));
      } catch {}
    }
  });
  return xhr;
}
InterceptedXHR.prototype = OriginalXHR.prototype;
window.XMLHttpRequest = InterceptedXHR;

function walkAndExtract(obj) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) walkAndExtract(item);
    return;
  }
  if (
    typeof obj.url === "string" &&
    obj.url.startsWith("https://t.co/") &&
    typeof obj.expanded_url === "string"
  ) {
    window.__urlCleanerMap[obj.url] = obj.expanded_url;
    // Notify the content script world
    window.dispatchEvent(new CustomEvent("__urlCleanerUpdate", {
      detail: { tco: obj.url, expanded: obj.expanded_url }
    }));
    return;
  }
  for (const val of Object.values(obj)) walkAndExtract(val);
}
