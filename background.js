chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "UPDATE_BADGE" && sender.tab?.id) {
    const count = message.count;
    chrome.action.setBadgeText({
      text: count > 0 ? String(count) : "",
      tabId: sender.tab.id,
    });
    chrome.action.setBadgeBackgroundColor({ color: "#1d9bf0" });
  }
});
