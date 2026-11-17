// Pure logic extracted from content.js for testability

export function extractUrlFromText(innerText) {
  // Firefox's innerText puts line breaks between the spans X splits long links into,
  // and a URL never contains whitespace
  const text = innerText.replace(/\s+/g, "").replace(/\u2026$/, "");
  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }
  return null;
}
