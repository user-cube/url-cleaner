// Pure logic extracted from intercept.js for testability

export function walkAndExtract(obj, onFound) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) walkAndExtract(item, onFound);
    return;
  }
  if (
    typeof obj.url === "string" &&
    obj.url.startsWith("https://t.co/") &&
    typeof obj.expanded_url === "string"
  ) {
    onFound(obj.url, obj.expanded_url);
    return;
  }
  for (const val of Object.values(obj)) walkAndExtract(val, onFound);
}
