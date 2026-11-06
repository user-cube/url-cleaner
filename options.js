const inputs = document.querySelectorAll("input[type=checkbox]");

chrome.storage.sync.get(URL_CLEANER_DEFAULTS, (stored) => {
  for (const input of inputs) {
    input.checked = stored[input.name];
    input.addEventListener("change", () => {
      chrome.storage.sync.set({ [input.name]: input.checked }, () => {
        document.getElementById("status").textContent = chrome.runtime.lastError
          ? "Could not save this change."
          : "Saved. Reload X to apply it.";
      });
    });
  }
});
