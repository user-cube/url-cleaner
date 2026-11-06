# Store listing

Source text for the Chrome Web Store and Firefox Add-ons (AMO) listings. Both dashboards are edited by hand, so paste from here when this file changes.

The short description in `manifest.json` is what Chrome shows as its summary. It goes live when a new package is uploaded.

## Permission justification (Chrome)

`storage`: saves the user's options.

## Links

- Homepage: https://github.com/user-cube/url-cleaner
- Support: https://github.com/user-cube/url-cleaner/issues

## Summary (AMO)

Open source. Resolves t.co short links on Twitter/X to their final destination URL.

## Description (both stores)

Open source: https://github.com/user-cube/url-cleaner (Apache License 2.0)

Twitter wraps every external link in tweets with a t.co redirect for analytics tracking. If you block t.co on your network (via DNS, Pi-hole, firewall, etc.), clicking any link on Twitter/X fails.

This extension fixes that by intercepting Twitter's own API responses, which already contain the real destination URLs, and rewriting the t.co links in the page before you click them. No requests are made to t.co.

Features:
• Works on twitter.com and x.com
• Handles both inline tweet links and card preview links
• Updates dynamically as you scroll and new tweets load
• Removes utm_*, fbclid and similar tracking parameters from resolved links
• Warns before opening a link that is still on t.co
• Tooltip on hover shows the real destination URL
• A subtle ✓ marks resolved links
• Popup lists the resolved links on the page, with buttons to copy them
• Icon badge counts the resolved links
• Options to turn each of these on or off
• No data collection, no external requests
