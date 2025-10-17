(() => {
  if (!location.pathname.startsWith("/problemset")) return;

  const LINK_SELECTOR = 'a[href^="/problem/"]';
  const STYLE_ID = "boj-status-badge-style-list";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .boj-badge { display:inline-block; margin-left:6px; padding:2px 6px; border-radius:999px;
        font-size:12px; font-weight:600; vertical-align:middle; box-shadow:0 1px 2px rgba(0,0,0,.06); }
      .boj-badge.ac { background:#e8f5e9; color:#1b5e20; }
      .boj-badge.tried { background:#ffebee; color:#b71c1c; }
      .boj-badge.none { background:#eceff1; color:#37474f; }
    `;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function verdictOf(rec, pid) {
    if (!rec) return "NONE";
    if (rec.solved && rec.solved[pid]) return "AC";
    if (rec.attempts && rec.attempts[pid]) return "TRIED";
    return "NONE";
  }

  function label(verdict) {
    if (verdict === "AC") return "AC";
    if (verdict === "TRIED") return "시도";
    return "미시도";
  }

  function cls(verdict) {
    return verdict === "AC" ? "ac" : verdict === "TRIED" ? "tried" : "none";
  }

  function upsertBadge(anchor, verdict, handle) {
    if (!anchor) return;
    let badge = anchor.nextElementSibling;
    if (!badge || !badge.classList || !badge.classList.contains("boj-badge")) {
      badge = document.createElement("span");
      badge.className = "boj-badge";
      anchor.insertAdjacentElement("afterend", badge);
    }
    badge.textContent = label(verdict);
    badge.title = handle ? `${handle} — ${label(verdict)}` : label(verdict);
    badge.classList.remove("ac", "tried", "none");
    badge.classList.add(cls(verdict));
  }

  function scanAndRender(rec, handle) {
    const anchors = document.querySelectorAll(LINK_SELECTOR);
    anchors.forEach((a) => {
      const m = a.getAttribute("href").match(/\/problem\/(\d+)/);
      if (!m) return;
      const pid = m[1];
      const v = verdictOf(rec, pid);
      upsertBadge(a, v, handle);
    });
  }

  function run() {
    chrome.storage.local.get(null, (data) => {
      const handle = data.activeHandle;
      const rec = handle ? data[`user:${handle}`] : null;
      ensureStyle();
      scanAndRender(rec, handle);
    });
  }

  // 최초 실행
  run();

  // 필터/정렬/페이지 이동 등 DOM 변화 대응
  const mo = new MutationObserver(() => run());
  mo.observe(document.body, { childList: true, subtree: true });
})();
