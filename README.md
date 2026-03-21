# URL Cleaner — t.co Resolver

A browser extension that transparently resolves `t.co` short links on Twitter/X to their real destination URL before you navigate.

## Problem

Twitter wraps every external link in tweets with a `t.co` redirect for analytics tracking. If you block `t.co` on your network (via DNS, firewall, Pi-hole, etc.), clicking any link on Twitter/X fails — you never reach the actual website.

## Solution

This extension intercepts Twitter's own API responses to extract the real destination URLs, then rewrites the links in the page before you ever click them. No network requests to `t.co` are made.

## Features

- Works on `twitter.com` and `x.com`, including incognito mode
- Handles both inline tweet links and card preview links
- Updates dynamically as you scroll and new tweets load
- **Tooltip on hover** — shows the real destination URL when hovering over a resolved link
- **Visual indicator** — a subtle `✓` mark on resolved links so you know they're safe to click
- **Popup** — click the extension icon to see all resolved links on the current page
- **Badge** — the extension icon shows a count of resolved links on the current page
- No data collection, no external requests

## How it works

Two content scripts work together:

- **`intercept.js`** — runs at `document_start` in the page's JS context (`MAIN` world), overrides `window.fetch` and `XMLHttpRequest` to intercept Twitter's GraphQL API responses and extract `t.co → expanded_url` mappings. Fires `CustomEvent`s to notify the isolated world.
- **`content.js`** — runs at `document_idle` in the isolated world, rewrites `t.co` hrefs in the DOM. For inline text links, the URL is recovered directly from the visible link text. For card preview links, it uses the mappings received from `intercept.js`. Uses a `MutationObserver` to handle tweets loaded dynamically as you scroll.

This approach works entirely offline with respect to `t.co` — no outbound requests are made to the blocked domain.

## Installation

### Chrome / Edge / Brave

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** and select this repository folder
4. Go to **Details** and make sure site access is enabled for `twitter.com` and `x.com`

### Firefox

Install from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/url-cleaner-t-co-resolver/), or load temporarily:

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select the `manifest.json` file

## Permissions

| Permission | Reason |
|---|---|
| `host_permissions: https://t.co/*` | Resolve t.co URLs if needed |
| `host_permissions: https://twitter.com/*`, `https://x.com/*` | Inject content scripts into Twitter/X pages |

## Files

```
url-cleaner/
├── manifest.json     Extension manifest (MV3)
├── intercept.js      Fetch/XHR interceptor (MAIN world, document_start)
├── content.js        DOM rewriter + UI (isolated world, document_idle)
├── background.js     Service worker — updates badge
├── popup.html        Popup UI
├── popup.js          Popup logic
└── icons/            Extension icons (16, 32, 48, 128px)
```
