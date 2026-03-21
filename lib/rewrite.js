// Pure logic extracted from content.js for testability

export function extractUrlFromText(innerText) {
  const text = innerText.trim().replace(/\u2026$/, "");
  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }
  return null;
}
