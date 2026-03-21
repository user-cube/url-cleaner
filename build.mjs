import { execSync } from "child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf-8"));

const EXCLUDE = [
  "*.git*",
  "*.DS_Store",
  "node_modules/*",
  "tests/*",
  "playwright-report/*",
  "test-results/*",
  "*.config.js",
  ".releaserc.yml",
  ".claude/*",
  "screenshot.jpg",
  "build.mjs",
  "dist/*",
  "url-cleaner-chrome.zip",
  "url-cleaner-firefox.zip",
];

const excludeArgs = EXCLUDE.map((e) => `-x '${e}'`).join(" ");

// Chrome manifest — no browser_specific_settings, no scripts fallback
const chromeManifest = structuredClone(manifest);
delete chromeManifest.browser_specific_settings;
writeFileSync("manifest.json", JSON.stringify(chromeManifest, null, 2));
execSync(`zip -r url-cleaner-chrome.zip . ${excludeArgs}`, { stdio: "inherit" });

// Firefox manifest — scripts only (no service_worker), bump min versions for data_collection_permissions
const firefoxManifest = structuredClone(manifest);
firefoxManifest.background = {
  scripts: ["background.js"],
};
firefoxManifest.browser_specific_settings.gecko.strict_min_version = "140.0";
firefoxManifest.browser_specific_settings.gecko_android = {
  strict_min_version: "142.0",
};
writeFileSync("manifest.json", JSON.stringify(firefoxManifest, null, 2));
execSync(`zip -r url-cleaner-firefox.zip . ${excludeArgs}`, { stdio: "inherit" });

// Restore original manifest
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));

console.log("Built url-cleaner-chrome.zip and url-cleaner-firefox.zip");
