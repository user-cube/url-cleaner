import { describe, it, expect } from "vitest";
import { extractUrlFromText } from "../lib/rewrite.js";

describe("extractUrlFromText", () => {
  it("returns a full https URL from text", () => {
    expect(extractUrlFromText("https://example.com/path")).toBe("https://example.com/path");
  });

  it("returns a full http URL from text", () => {
    expect(extractUrlFromText("http://example.com")).toBe("http://example.com");
  });

  it("strips trailing ellipsis (…) from truncated URLs", () => {
    expect(extractUrlFromText("https://example.com/very/long/path\u2026")).toBe(
      "https://example.com/very/long/path"
    );
  });

  it("trims whitespace before checking", () => {
    expect(extractUrlFromText("  https://example.com  ")).toBe("https://example.com");
  });

  it("returns null for non-URL text (card title)", () => {
    expect(extractUrlFromText("Some Article Title")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractUrlFromText("")).toBeNull();
  });

  it("returns null for t.co URL (should not be used as expanded)", () => {
    expect(extractUrlFromText("https://t.co/abc123")).toBe("https://t.co/abc123");
  });
});
