chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: "GET_RESOLVED" }, (links) => {
    if (chrome.runtime.lastError || !links || links.length === 0) return;

    document.getElementById("empty").style.display = "none";
    document.getElementById("count").textContent = links.length;

    const ul = document.getElementById("list");
    for (const { tco, expanded } of links) {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.className = "tco";
      span.textContent = tco;
      const a = document.createElement("a");
      a.className = "expanded";
      a.href = expanded;
      a.target = "_blank";
      a.textContent = expanded;
      li.appendChild(span);
      li.appendChild(a);
      ul.appendChild(li);
    }
  });
});
