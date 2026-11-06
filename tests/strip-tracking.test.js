import { readFileSync } from "fs";
import { describe, expect, test } from "vitest";

const stripTracking = new Function(
  `${readFileSync("lib/strip-tracking.js", "utf-8")}; return stripTracking;`,
)();

describe("stripTracking", () => {
  test.each([
    ["https://example.com/a?utm_source=x&utm_medium=y", "https://example.com/a"],
    ["https://example.com/a?id=1&utm_source=x", "https://example.com/a?id=1"],
    ["https://example.com/a?fbclid=abc&id=1&gclid=def", "https://example.com/a?id=1"],
    ["https://example.com/a?UTM_Source=x", "https://example.com/a"],
    ["https://example.com/a?utm_source=x#section", "https://example.com/a#section"],
    ["https://www.youtube.com/watch?v=abc&si=xyz", "https://www.youtube.com/watch?v=abc"],
    ["https://youtu.be/abc?si=xyz&t=30", "https://youtu.be/abc?t=30"],
    ["https://open.spotify.com/track/abc?si=xyz", "https://open.spotify.com/track/abc"],
  ])("removes tracking from %s", (input, expected) => {
    expect(stripTracking(input)).toBe(expected);
  });

  test.each([
    "https://example.com/",
    "https://example.com/a?id=1&page=2",
    "https://example.com/a?si=keep",
    "https://example.com/a?q=a%20b+c&empty=&flag",
    "https://example.com/a#utm_source=x",
    "https://example.com/?ref=home&source=nav",
    "not a url?si=keep",
  ])("leaves %s unchanged", (input) => {
    expect(stripTracking(input)).toBe(input);
  });

  test("keeps the encoding and order of the remaining parameters", () => {
    expect(stripTracking("https://example.com/?b=a%20b&utm_id=1&a=c+d&flag")).toBe(
      "https://example.com/?b=a%20b&a=c+d&flag",
    );
  });
});
