import { describe, it, expect, vi } from "vitest";
import { walkAndExtract } from "../lib/extract.js";

describe("walkAndExtract", () => {
  it("finds a direct t.co mapping", () => {
    const onFound = vi.fn();
    walkAndExtract(
      { url: "https://t.co/abc123", expanded_url: "https://example.com" },
      onFound
    );
    expect(onFound).toHaveBeenCalledWith("https://t.co/abc123", "https://example.com");
  });

  it("finds nested t.co mappings", () => {
    const onFound = vi.fn();
    walkAndExtract(
      { data: { user: { entities: { url: "https://t.co/xyz", expanded_url: "https://real.com" } } } },
      onFound
    );
    expect(onFound).toHaveBeenCalledWith("https://t.co/xyz", "https://real.com");
  });

  it("finds t.co mappings inside arrays", () => {
    const onFound = vi.fn();
    walkAndExtract(
      { urls: [{ url: "https://t.co/a1", expanded_url: "https://one.com" }, { url: "https://t.co/b2", expanded_url: "https://two.com" }] },
      onFound
    );
    expect(onFound).toHaveBeenCalledTimes(2);
    expect(onFound).toHaveBeenCalledWith("https://t.co/a1", "https://one.com");
    expect(onFound).toHaveBeenCalledWith("https://t.co/b2", "https://two.com");
  });

  it("ignores non-t.co urls", () => {
    const onFound = vi.fn();
    walkAndExtract(
      { url: "https://example.com/foo", expanded_url: "https://other.com" },
      onFound
    );
    expect(onFound).not.toHaveBeenCalled();
  });

  it("ignores entries missing expanded_url", () => {
    const onFound = vi.fn();
    walkAndExtract({ url: "https://t.co/abc" }, onFound);
    expect(onFound).not.toHaveBeenCalled();
  });

  it("handles null and primitives gracefully", () => {
    const onFound = vi.fn();
    walkAndExtract(null, onFound);
    walkAndExtract(42, onFound);
    walkAndExtract("string", onFound);
    expect(onFound).not.toHaveBeenCalled();
  });

  it("handles deeply nested GraphQL-like response", () => {
    const onFound = vi.fn();
    walkAndExtract(
      {
        data: {
          tweetResult: {
            result: {
              legacy: {
                entities: {
                  urls: [
                    { url: "https://t.co/deep1", expanded_url: "https://deep-real.com", display_url: "deep-real.com" }
                  ]
                }
              }
            }
          }
        }
      },
      onFound
    );
    expect(onFound).toHaveBeenCalledWith("https://t.co/deep1", "https://deep-real.com");
  });
});
