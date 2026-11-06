// Toast shown when the user clicks a t.co link that has not been resolved.
// Lives in a shadow root so the page's styles cannot affect it.

const WARNING_STYLE = `
  :host { all: initial; }
  .toast {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    width: 340px;
    padding: 14px 16px;
    box-sizing: border-box;
    border: 1px solid #cfd9de;
    border-radius: 12px;
    background: #ffffff;
    color: #0f1419;
    font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
  }
  .title { margin: 0 0 4px; font-weight: 600; }
  .detail { margin: 0 0 12px; color: #536471; font-size: 13px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  button {
    padding: 6px 12px;
    border: 1px solid #cfd9de;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover { background: rgba(83, 100, 113, 0.12); }
  @media (prefers-color-scheme: dark) {
    .toast { border-color: #38444d; background: #15202b; color: #e7e9ea; }
    .detail { color: #8b98a5; }
    button { border-color: #536471; }
  }
`;

const WARNING_TIMEOUT_MS = 8000;
let dismissWarning = null;

function showUnresolvedWarning(tco) {
  if (dismissWarning) dismissWarning();

  const host = document.createElement("div");
  host.id = "url-cleaner-warning";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = WARNING_STYLE;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "alert");

  const title = document.createElement("p");
  title.className = "title";
  title.textContent = "This link is not resolved yet";

  const detail = document.createElement("p");
  detail.className = "detail";
  detail.textContent = "URL Cleaner has not found its destination. Opening it goes through t.co, which fails if you block t.co.";

  const actions = document.createElement("div");
  actions.className = "actions";

  const close = document.createElement("button");
  close.textContent = "Dismiss";

  const open = document.createElement("button");
  open.textContent = "Open via t.co";

  const timer = setTimeout(() => dismissWarning?.(), WARNING_TIMEOUT_MS);
  dismissWarning = () => {
    clearTimeout(timer);
    host.remove();
    dismissWarning = null;
  };

  close.addEventListener("click", () => dismissWarning());
  open.addEventListener("click", () => {
    window.open(tco, "_blank", "noopener");
    dismissWarning();
  });

  actions.append(close, open);
  toast.append(title, detail, actions);
  shadow.append(style, toast);
  document.documentElement.appendChild(host);
}
