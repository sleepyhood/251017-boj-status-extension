(() => {
  // 목록 페이지에서만 동작
  const path = location.pathname;
  const isListPage =
    path.startsWith("/problemset") ||
    path.startsWith("/workbook/view/") ||
    path.startsWith("/step/");
  if (!isListPage) return;

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
    .boj-badge.pa { background:#fff8e1; color:#e65100; }

      `;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function label(verdict) {
    if (verdict === "AC") return "AC";
    if (verdict === "PA") return "부분점수";
    if (verdict === "TRIED") return "시도";
    return "미시도";
  }

  function verdictOf(rec, pid) {
    if (!rec) return "NONE";
    if (rec.solved && rec.solved[pid]) return "AC";
    if (rec.attempts && rec.attempts[pid])
      return rec.attempts[pid].verdict || "TRIED";
    return "NONE";
  }

  function cls(verdict) {
    return verdict === "AC"
      ? "ac"
      : verdict === "PA"
      ? "pa"
      : verdict === "TRIED"
      ? "tried"
      : "none";
  }

  function extractPid(anchor) {
    try {
      const p = new URL(anchor.href).pathname; // '/problem/1000'
      if (!p.startsWith("/problem/")) return null;
      const pid = p.slice("/problem/".length).split("/")[0];
      return /^[0-9]+$/.test(pid) ? pid : null;
    } catch {
      return null;
    }
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
      const pid = extractPid(a);
      if (!pid) return;
      const v = verdictOf(rec, pid);
      upsertBadge(a, v, handle);
    });
  }

  const run = () => {
    chrome.storage.local.get(null, (data) => {
      const handle = (data.activeHandle || "").trim().toLowerCase();
      let rec = handle ? data[`user:${handle}`] : null;
      if (!rec && handle) {
        const foundKey = Object.keys(data).find(
          (k) => k.startsWith("user:") && k.slice(5).toLowerCase() === handle
        );
        if (foundKey) {
          rec = data[foundKey];
          chrome.storage.local.set({ [`user:${handle}`]: rec });
        }
      }
      ensureStyle();
      scanAndRender(rec, handle);
    });
  };

  // 최초 실행 + DOM 변화 대응(디바운스)
  run();
  let ticking = false;
  const mo = new MutationObserver(() => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      run();
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
