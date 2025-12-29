(() => {
  const url = new URL(location.href);
  const handle = (url.searchParams.get("user_id") || "").trim().toLowerCase();
  if (!handle) return;

  // ===== Toast UI (status page) =====
  const TOAST_STYLE_ID = "boj-status-toast-style";
  const TOAST_ID = "boj-status-toast";
  let toastShown = false;

  function ensureToastStyle() {
    if (document.getElementById(TOAST_STYLE_ID)) return;
    const css = `
#${TOAST_ID}{
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 2147483647;
  display:flex;
  align-items:center;
  gap:10px;
  padding: 10px 12px;
  border-radius: 14px  !important;  
  border: 1px solid rgba(226,232,240,.8);
  background: rgba(255,255,255,.92);
  color: #1e293b;
  box-shadow: 0 10px 25px rgba(0,0,0,.12);
  backdrop-filter: blur(10px);
  font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
#${TOAST_ID} .msg{ display:flex; flex-direction:column; gap:3px; }
#${TOAST_ID} .title{ font-weight: 900; }
#${TOAST_ID} .sub{ font-size: 11px; opacity:.7; }
#${TOAST_ID} .btn{
  border: 1px solid rgba(226,232,240,.9);
  background: rgba(99,102,241,.10);
  color: #4f46e5;
  padding: 6px 10px;
  border-radius: 999px  !important;
  font-weight: 800;
  cursor: pointer;
}
#${TOAST_ID} .btn:hover{ background: rgba(99,102,241,.16); }
#${TOAST_ID} .x{
  width: 30px; height: 30px;
  border-radius: 999px  !important;
  border: 1px solid rgba(226,232,240,.9);
  background: transparent;
  cursor: pointer;
  font-weight: 900;
  opacity: .7;
}
#${TOAST_ID} .x:hover{ opacity: 1; }
@media (prefers-color-scheme: dark){
  #${TOAST_ID}{
    background: rgba(15,23,42,.88);
    color: #f1f5f9;
    border-color: rgba(51,65,85,.8);
    box-shadow: 0 20px 50px rgba(0,0,0,.5);
  }
  #${TOAST_ID} .btn{
    border-color: rgba(51,65,85,.9);
    background: rgba(99,102,241,.16);
    color: #c7d2fe;
  }
  #${TOAST_ID} .x{ border-color: rgba(51,65,85,.9); color:#f1f5f9; }
}
`;
    const style = document.createElement("style");
    style.id = TOAST_STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showToast(title, subtitle, { actionLabel, onAction } = {}) {
    ensureToastStyle();

    document.getElementById(TOAST_ID)?.remove();

    const wrap = document.createElement("div");
    wrap.id = TOAST_ID;

    const msg = document.createElement("div");
    msg.className = "msg";

    const t = document.createElement("div");
    t.className = "title";
    t.textContent = title;

    const s = document.createElement("div");
    s.className = "sub";
    s.textContent = subtitle || "";

    msg.appendChild(t);
    msg.appendChild(s);
    wrap.appendChild(msg);

    if (actionLabel && typeof onAction === "function") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = actionLabel;
      btn.addEventListener("click", () => {
        try {
          onAction();
        } finally {
          wrap.remove();
        }
      });
      wrap.appendChild(btn);
    }

    const x = document.createElement("button");
    x.type = "button";
    x.className = "x";
    x.textContent = "×";
    x.addEventListener("click", () => wrap.remove());
    wrap.appendChild(x);

    document.body.appendChild(wrap);
    window.setTimeout(() => wrap.remove(), 4500);
  }
  // ===== /Toast UI =====

  function detectVerdictText(row) {
    const el = row.querySelector(".result, .status, .verdict, td[title]");
    let t = el ? el.textContent || el.getAttribute("title") || "" : "";
    if (!t) {
      const tds = [...row.querySelectorAll("td")];
      t = tds.map((td) => (td.textContent || "").trim()).join(" ");
    }
    return (t || "").trim();
  }

  function mapVerdictText(t) {
    if (/맞았습니다|Accepted/i.test(t)) return "AC";
    if (/부분\s*점수|만점.*못|Partial/i.test(t)) return "PA";
    if (/컴파일\s*에러|Compile/i.test(t)) return "CE";
    if (/런타임\s*에러|Runtime/i.test(t)) return "RE";
    if (/메모리\s*초과|Memory/i.test(t)) return "MLE";
    if (/시간\s*초과|Time/i.test(t)) return "TLE";
    if (/출력\s*초과|Output/i.test(t)) return "OLE";
    if (/출력\s*형식|Presentation/i.test(t)) return "PE";
    if (/틀렸습니다|Wrong/i.test(t)) return "WA";
    if (/채점|Judging|Running|Pending|Queue/i.test(t)) return "TRIED"; // 일단 시도로만 취급
    return "TRIED";
  }

  function scrapeOnce() {
    const rows = [
      ...document.querySelectorAll("#status-table tbody tr"),
      ...document.querySelectorAll("table tbody tr"),
    ];

    const updates = {};
    for (const row of rows) {
      const a = row.querySelector('a[href^="/problem/"]');
      const href = a?.getAttribute("href") || "";
      const m = href.match(/\/problem\/(\d+)/);
      if (!m) continue;

      const pid = m[1];
      if (updates[pid]) continue; // 최신 제출(상단)을 우선으로 1개만

      const vt = mapVerdictText(detectVerdictText(row));
      updates[pid] = vt;
    }

    const pids = Object.keys(updates);
    if (pids.length === 0) return false;

    const appliedCount = pids.length;

    const key = `user:${handle}`;
    chrome.storage.local.get([key], (data) => {
      const existed = !!data[key];
      const cur = data[key] || { solved: {}, attempts: {}, updatedAt: 0 };
      const now = Date.now();

      for (const pid of pids) {
        const vt = updates[pid];
        if (vt === "AC") {
          cur.solved[pid] = true;
          delete cur.attempts[pid];
        } else if (!cur.solved[pid]) {
          cur.attempts[pid] = { verdict: vt, ts: now };
        }
      }

      cur.updatedAt = now;

      // ✅ activeHandle은 popup에서만 관리 (여기서 덮어쓰지 않음)
      chrome.storage.local.set(
        { [key]: cur, lastScrapedHandle: handle },
        () => {
          if (toastShown) return;
          toastShown = true;

          const title = existed ? "학생 업데이트 완료" : "학생 추가 완료";
          const sub = `@${handle} · ${appliedCount}개 기록 반영 · ${new Date(
            now
          ).toLocaleString("ko-KR")}`;

          showToast(title, sub, {
            actionLabel: "학생 목록",
            onAction: () =>
              window.open(
                chrome.runtime.getURL("options.html#students"),
                "_blank"
              ),
          });
        }
      );
    });

    return true;
  }

  // status 테이블이 늦게 렌더링되는 경우 대비: 0.4s 간격 재시도
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const ok = scrapeOnce();
    if (ok || tries >= 10) clearInterval(timer);
  }, 400);
})();
