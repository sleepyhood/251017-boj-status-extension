(() => {
  const m = location.pathname.match(/\/problem\/(\d+)/);
  if (!m) return;
  const pid = m[1];

  const STYLE_ID = "boj-status-badge-style-problem";
  const POPOVER_ID = "boj-status-popover-problem";
  const norm = (s) => (s || "").trim().toLowerCase();

  function ensureStyle() {
    // if (document.getElementById(STYLE_ID)) return;
    const css = `
  :root {
    --boj-text: #1e293b;
    --boj-muted: #64748b;
    --boj-border: rgba(226, 232, 240, 0.6);
    --boj-surface: rgba(255, 255, 255, 0.75);
    --boj-surface-2: rgba(248, 250, 252, 0.9);
    --boj-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    --boj-accent: #6366f1;
    --boj-radius: 20px !important;
    --boj-blur: 16px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --boj-text: #f1f5f9;
      --boj-muted: #94a3b8;
      --boj-border: rgba(51, 65, 85, 0.5);
      --boj-surface: rgba(15, 23, 42, 0.7);
      --boj-surface-2: rgba(30, 41, 59, 0.8);
      --boj-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
  }

  /* Badge styling */
  #boj-status-badge {
  
    position: fixed;
    top: 16px; right: 16px;
    padding: 10px 16px;
    border-radius: var(--boj-radius) !important;
    font-size: 13px;
    font-weight: 700;
    color: var(--boj-text);
    background: var(--boj-surface);
    border: 1px solid var(--boj-border);
    box-shadow: var(--boj-shadow);
    backdrop-filter: blur(var(--boj-blur));
    -webkit-backdrop-filter: blur(var(--boj-blur));
    z-index: 9999;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex; align-items: center; gap: 8px;
  }
  #boj-status-badge:hover { transform: translateY(-2px) scale(1.02); background: var(--boj-surface-2); }
  #boj-status-badge.mix { border-left: 4px solid var(--boj-accent); }

  /* Popover Animation */
  @keyframes bojPopIn {
    from { opacity: 0; transform: translateY(10px) scale(0.95); filter: blur(4px); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
  }

  #${POPOVER_ID}::-webkit-scrollbar { display: none; }

/* Popover Main Container */
  #${POPOVER_ID} {
    position: fixed;
    top: 80px; right: 20px;
    width: 360px;
    max-height: 75vh;
    background: var(--boj-surface);
    border: 1px solid var(--boj-border);
    border-radius: var(--boj-radius) !important;
    box-shadow: var(--boj-shadow);
    backdrop-filter: blur(var(--boj-blur));
    -webkit-backdrop-filter: blur(var(--boj-blur));
    z-index: 10000;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: var(--boj-text);
    display: flex; flex-direction: column;
    overflow: hidden; /* ✅ 자식 요소의 삐져나옴 방지 (border-radius 해결) */
    animation: bojPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* Sticky Header */
  #${POPOVER_ID} .head {
    padding: 20px;
    background: var(--boj-surface-2);
    border-bottom: 1px solid var(--boj-border);
    display: flex; justify-content: space-between; align-items: center;
  }
  #${POPOVER_ID} .title { font-size: 16px; font-weight: 800; letter-spacing: -0.5px; }
  #${POPOVER_ID} .sub { font-size: 11px; color: var(--boj-muted); margin-top: 2px; }

  /* Section (Bento Box style) */
  #${POPOVER_ID} .section {
    margin: 12px;
    padding: 16px;
  border-radius: calc(var(--boj-radius) - 6px) !important;
    background: rgba(148, 163, 184, 0.05);
    border: 1px solid var(--boj-border);
    transition: background 0.2s ease;
  }
  #${POPOVER_ID} .section:hover { background: rgba(148, 163, 184, 0.1); }

  #${POPOVER_ID} .sectionHead {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }

  /* Status Colors */
  .tone-ac { --status-color: #22c55e; }
  .tone-pa { --status-color: #f59e0b; }
  .tone-tried { --status-color: #ef4444; }
  .tone-none { --status-color: #94a3b8; }
  .tone-nodata { --status-color: #64748b; }

  #${POPOVER_ID} .bojLabel {
    display: flex; align-items: center; gap: 8px;
    font-weight: 800; font-size: 13px; color: var(--status-color) !important;
  }
  #${POPOVER_ID} .dot {
    width: 6px; height: 6px; border-radius: 50% !important;
    background: var(--status-color);
    box-shadow: 0 0 8px var(--status-color);
  }

  /* Modern Chips */
  #${POPOVER_ID} .chips {
    display: flex; flex-wrap: wrap; gap: 6px;
      max-height: 120px;       /* ✅ 학생 많을 때 섹션이 너무 길어지지 않게 */
  overflow: auto;
  padding-right: 2px;
  scrollbar-width: thin;
  }
  /* (선택) WebKit 스크롤바를 너무 숨기지 말고 얇게 */
#${POPOVER_ID} .chips::-webkit-scrollbar { width: 8px; }
#${POPOVER_ID} .chips::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 999px !important;
}
#${POPOVER_ID} .chip {
  padding: 6px 10px;
  background: rgba(255,255,255,0.35);
  border: 1px solid var(--boj-border);

  border-radius: 999px !important;    /* ✅ pill */
  font-size: 11px;
  font-weight: 700;
  color: var(--boj-text);
  opacity: .9;

  transition: transform .12s ease, background .12s ease;
}
#${POPOVER_ID} .chip:hover {
  background: rgba(248, 250, 252, 0.7);
  transform: translateY(-1px);
}
@media (prefers-color-scheme: dark){
  #${POPOVER_ID} .chip { background: rgba(2,6,23,0.22); }
  #${POPOVER_ID} .chip:hover { background: rgba(30,41,59,0.5); }
}
  /* Action Buttons */
  #${POPOVER_ID} .btn {
    padding: 4px 12px;
      border-radius: calc(var(--boj-radius) - 12px) !important;

    border: 1px solid var(--boj-border);
    background: var(--boj-surface);
    color: var(--boj-text);
    font-size: 11px; font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  #${POPOVER_ID} .btn:hover { background: var(--boj-text); color: var(--boj-surface); }
  
  #${POPOVER_ID} .close {
    width: 28px; height: 28px; border-radius: 50% !important;
    border: none; background: rgba(148, 163, 184, 0.1);
    color: var(--boj-text); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: 0.2s;
  }
  #${POPOVER_ID} .close:hover { background: #ef4444; color: white; transform: rotate(90deg); }

  #${POPOVER_ID} .count{
  font-size: 12px;
  font-weight: 800;
  color: var(--boj-muted);
}

#${POPOVER_ID} .empty{
  font-size: 12px;
  font-weight: 700;
  color: var(--boj-muted);
  padding: 4px 2px;
}
#${POPOVER_ID} .btn:focus-visible,
#${POPOVER_ID} .close:focus-visible,
#boj-status-badge:focus-visible {
  outline: 3px solid rgba(99, 102, 241, 0.35);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce){
  #boj-status-badge { transition: none; }
  #${POPOVER_ID} { animation: none; }
  #${POPOVER_ID} .chip { transition: none; }
}

`;
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      existing.textContent = css; // ✅ 갱신
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function parseAllHandles(data) {
    const map = new Map(); // lower -> storedKey
    for (const k of Object.keys(data)) {
      if (!k.startsWith("user:")) continue;
      const lower = norm(k.slice(5));
      if (lower) map.set(lower, k);
    }
    return map;
  }

  function getHandlesInScope(data, allHandleMap) {
    const all = [...allHandleMap.keys()].sort();
    const mode = data.badgeMode || "single"; // single | all | selected

    if (mode === "all") return all;

    if (mode === "selected") {
      const sel = Array.isArray(data.selectedHandles)
        ? data.selectedHandles.map(norm).filter(Boolean)
        : [];
      const uniq = [...new Set(sel)];
      return uniq.length ? uniq : all;
    }

    const h = norm(data.activeHandle);
    return h ? [h] : all;
  }

  function buildRecByHandle(data, handleMap, handles) {
    const migrate = {};
    const recBy = {};
    for (const h of handles) {
      const canonicalKey = `user:${h}`;
      const storedKey = handleMap.get(h);
      const rec =
        data[canonicalKey] || (storedKey ? data[storedKey] : null) || null;

      if (
        !data[canonicalKey] &&
        rec &&
        storedKey &&
        storedKey !== canonicalKey
      ) {
        migrate[canonicalKey] = rec;
      }
      recBy[h] = rec;
    }
    if (Object.keys(migrate).length) chrome.storage.local.set(migrate);
    return recBy;
  }

  function verdictFromRec(rec, pid) {
    if (!rec) return "NODATA";
    if (rec.solved && rec.solved[pid]) return "AC";
    if (rec.attempts && rec.attempts[pid])
      return rec.attempts[pid].verdict || "TRIED";
    return "NONE";
  }

  function makeBreakdown(pid, handles, recByHandle) {
    const bd = { AC: [], PA: [], TRIED: [], NONE: [], NODATA: [] };
    for (const h of handles) {
      const v = verdictFromRec(recByHandle[h], pid);
      if (v === "AC") bd.AC.push(h);
      else if (v === "PA") bd.PA.push(h);
      else if (v === "TRIED") bd.TRIED.push(h);
      else if (v === "NONE") bd.NONE.push(h);
      else bd.NODATA.push(h);
    }
    return bd;
  }

  function setBadge(text, cls, detail) {
    const id = "boj-status-badge";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    el.textContent = text + (detail ? ` · ${detail}` : "");
    el.classList.remove("ac", "pa", "tried", "none", "mix");
    el.classList.add(cls);
    el.title = "클릭하면 학생 목록을 봅니다";
  }

  function closePopover() {
    const pop = document.getElementById(POPOVER_ID);
    if (pop) pop.remove();
  }

  function openPopover(bd, total) {
    closePopover();

    const pop = document.createElement("div");
    pop.id = POPOVER_ID;

    // Header 영역
    const head = document.createElement("div");
    head.className = "head";
    head.innerHTML = `
        <div class="titleWrap">
          <div class="title">✨ 현황 대시보드</div>
          <div class="sub" style="font-size:11px; color:var(--boj-muted)">Target: ${total} members</div>
        </div>
        <button class="close" type="button" style="background:none; border:none; color:var(--boj-text); cursor:pointer; font-size:18px;">✕</button>
      `;
    pop.appendChild(head);

    // 실제 콘텐츠가 담길 Bento Area
    const contentArea = document.createElement("div");
    contentArea.className = "content-area";

    const rows = [
      { key: "AC", label: "Solved", tone: "tone-ac", arr: bd.AC },
      { key: "PA", label: "Partial", tone: "tone-pa", arr: bd.PA },
      { key: "TRIED", label: "Attempted", tone: "tone-tried", arr: bd.TRIED },
      { key: "NONE", label: "Idle", tone: "tone-none", arr: bd.NONE },
    ];

    rows.forEach((r) => {
      const sec = document.createElement("div");
      sec.className = `section ${r.tone}`;

      sec.innerHTML = `
        <div class="sectionHead" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="bojLabel"><span class="dot"></span>${r.label}</div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:12px; font-weight:800; opacity:0.7;">${r.arr.length}</span>
            <button class="btn" type="button" data-copy="${r.key}">Copy</button>
          </div>
        </div>
      `;

      const chipsWrap = document.createElement("div");
      chipsWrap.className = "chips";
      if (r.arr.length === 0) {
        chipsWrap.innerHTML = `<span style="font-size:11px; color:var(--boj-muted); opacity:0.5;">Empty</span>`;
      } else {
        r.arr.forEach((h) => {
          const a = document.createElement("a");
          a.className = "chip";
          a.textContent = h;
          a.href = `https://www.acmicpc.net/status?user_id=${encodeURIComponent(
            h
          )}&problem_id=${encodeURIComponent(pid)}`;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          chipsWrap.appendChild(a);
        });
      }

      sec.appendChild(chipsWrap);
      contentArea.appendChild(sec);
    });

    pop.appendChild(contentArea);
    document.body.appendChild(pop);
  }

  ensureStyle();

  let lastBreakdown = null;
  let lastTotal = 0;

  chrome.storage.local.get(null, (data) => {
    const allHandleMap = parseAllHandles(data);
    const handles = getHandlesInScope(data, allHandleMap);

    if (!handles.length) {
      setBadge("핸들 없음", "none", "Options에서 학생 데이터 저장");
      return;
    }

    const recByHandle = buildRecByHandle(data, allHandleMap, handles);
    const bd = makeBreakdown(pid, handles, recByHandle);
    lastBreakdown = bd;
    lastTotal = handles.length;

    if (handles.length <= 1) {
      const h = handles[0];
      if (bd.AC.length) setBadge("AC", "ac", h);
      else if (bd.PA.length) setBadge("부분점수", "pa", `${h}/PA`);
      else if (bd.TRIED.length) setBadge("시도함", "tried", `${h}/TRIED`);
      else if (bd.NODATA.length) setBadge("데이터없음", "none", h);
      else setBadge("미시도", "none", h);
    } else {
      const ac = bd.AC.length,
        pa = bd.PA.length,
        tr = bd.TRIED.length,
        no = bd.NONE.length,
        nd = bd.NODATA.length;
      let text = `AC${ac}·PA${pa}·시${tr}·미${no}`;
      if (nd) text += `·?${nd}`;
      setBadge(text, "mix", "");
    }
  });

  // ✅ click handler 바깥(한 번만 등록)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover();
  });

  // 클릭: 팝오버 토글
  document.addEventListener("click", (e) => {
    const badge = document.getElementById("boj-status-badge");
    const pop = document.getElementById(POPOVER_ID);

    if (pop && pop.contains(e.target)) {
      if (e.target.classList.contains("close")) {
        closePopover();
        return;
      }
      const copyKey = e.target.getAttribute("data-copy");
      if (copyKey && lastBreakdown) {
        navigator.clipboard
          .writeText((lastBreakdown[copyKey] || []).join("\n"))
          .catch(() => {});
        return;
      }
      return;
    }

    if (pop && !pop.contains(e.target)) closePopover();

    if (badge && (e.target === badge || badge.contains(e.target))) {
      if (!lastBreakdown) return;
      if (document.getElementById(POPOVER_ID)) closePopover();
      else openPopover(lastBreakdown, lastTotal);
    }
  });
})();
