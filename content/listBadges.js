let __boj_alive = true;

function safeStorageGet(keys, cb) {
  if (!__boj_alive) return;

  try {
    // runtime.id가 없으면 이미 컨텍스트가 끊긴 상태
    if (!chrome?.runtime?.id) {
      __boj_alive = false;
      return;
    }

    chrome.storage.local.get(keys, (data) => {
      // 콜백에서는 lastError로 조용히 무시
      if (chrome.runtime?.lastError) return;
      cb(data);
    });
  } catch (e) {
    // Extension context invalidated 등
    __boj_alive = false;
  }
}

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
  const POPOVER_ID = "boj-status-popover";

  // run() 때마다 갱신되는 pid -> breakdown 캐시
  let breakdownByPid = new Map();
  let handlesInScope = [];

  const norm = (s) => (s || "").trim().toLowerCase();

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
  :root {
    --boj-text: #1e293b;
    --boj-muted: #64748b;
    --boj-border: rgba(226, 232, 240, 0.6);
    --boj-surface: rgba(255, 255, 255, 0.75);
    --boj-surface-2: rgba(248, 250, 252, 0.9);
    --boj-shadow: 0 4px 6px -1px rgba(0,0,0,.05), 0 20px 25px -5px rgba(0,0,0,.10);
    --boj-accent: #6366f1;
    --boj-radius: 20px;
    --boj-blur: 16px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --boj-text: #f1f5f9;
      --boj-muted: #94a3b8;
      --boj-border: rgba(51, 65, 85, 0.5);
      --boj-surface: rgba(15, 23, 42, 0.7);
      --boj-surface-2: rgba(30, 41, 59, 0.8);
      --boj-shadow: 0 20px 50px rgba(0,0,0,.5);
    }
  }

  /* ===== List badge (pill) ===== */
  .boj-badge{
    display:inline-flex;
    align-items:center;
    gap:6px;
    margin-left:6px;
    padding:4px 10px;
    border-radius:999px !important;
    font-size:12px;
    font-weight:800;
    letter-spacing:-.2px;
    vertical-align:middle;
    box-shadow:0 1px 2px rgba(0,0,0,.06);
    cursor:pointer;
    user-select:none;
  }
  .boj-badge::before{
    content:"";
    width:6px; height:6px;
    border-radius:999px !important;
    background: currentColor;
    opacity:.9;
  }
  .boj-badge::after{
    content:"▾";
    font-size:11px;
    opacity:.55;
    margin-left:2px;
    line-height:1;
  }

  .boj-badge.ac { background:#e8f5e9; color:#1b5e20; }
  .boj-badge.tried { background:#ffebee; color:#b71c1c; }
  .boj-badge.none { background:#eceff1; color:#37474f; }
  .boj-badge.pa { background:#fff8e1; color:#e65100; }
  .boj-badge.mix { background:#e3f2fd; color:#0d47a1; }

  /* ===== Popover ===== */
  @keyframes bojPopIn {
    from { opacity:0; transform: translateY(10px) scale(.97); filter: blur(4px); }
    to   { opacity:1; transform: translateY(0) scale(1); filter: blur(0); }
  }

  #${POPOVER_ID}{
    position:absolute;
    width: 360px;
    max-width: min(360px, calc(100vw - 16px));
    max-height: 75vh;

    background: var(--boj-surface);
    border: 1px solid var(--boj-border);
    border-radius: var(--boj-radius) !important;
    box-shadow: var(--boj-shadow);

    backdrop-filter: blur(var(--boj-blur));
    -webkit-backdrop-filter: blur(var(--boj-blur));

    z-index: 2147483647;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    color: var(--boj-text);

    overflow: hidden; /* radius 클리핑 */
    animation: bojPopIn .35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  #${POPOVER_ID}::-webkit-scrollbar { display:none; }

  #${POPOVER_ID} .bojHead{
    padding: 16px 16px 14px;
    background: var(--boj-surface-2);
    border-bottom: 1px solid var(--boj-border);
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
  }
  #${POPOVER_ID} .bojTitle{ font-size:15px; font-weight:900; letter-spacing:-.4px; }
  #${POPOVER_ID} .bojSub{ font-size:11px; color:var(--boj-muted); margin-top:2px; font-weight:800; }
  #${POPOVER_ID} .bojClose{
    width: 30px; height: 30px;
    border-radius: 999px !important;
    border: 1px solid var(--boj-border);
    background: transparent;
    color: var(--boj-text);
    cursor: pointer;
    display:flex; align-items:center; justify-content:center;
    font-weight:900;
    transition: .18s;
  }
  #${POPOVER_ID} .bojClose:hover{ background: rgba(148,163,184,.12); transform: rotate(90deg); }

  #${POPOVER_ID} .bojContent{
    max-height: 75vh;
    overflow: auto;
  }
  #${POPOVER_ID} .bojContent::-webkit-scrollbar { width: 8px; }
  #${POPOVER_ID} .bojContent::-webkit-scrollbar-thumb {
    background: rgba(148,163,184,.35);
    border-radius: 999px !important;
  }

  /* status tone vars */
  #${POPOVER_ID} .tone-ac { --status-color:#22c55e; }
  #${POPOVER_ID} .tone-pa { --status-color:#f59e0b; }
  #${POPOVER_ID} .tone-tried { --status-color:#ef4444; }
  #${POPOVER_ID} .tone-none { --status-color:#94a3b8; }
  #${POPOVER_ID} .tone-nodata { --status-color:#64748b; }

  #${POPOVER_ID} .bojSection{
    margin: 12px;
    padding: 14px;
    border-radius: calc(var(--boj-radius) - 6px) !important;
    background: rgba(148,163,184,.05);
    border: 1px solid var(--boj-border);
    transition: background .2s ease;
  }
  #${POPOVER_ID} .bojSection:hover{ background: rgba(148,163,184,.10); }

  #${POPOVER_ID} .bojSectionHead{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-bottom: 10px;
  }
  #${POPOVER_ID} .bojLabel{
    display:flex;
    align-items:center;
    gap:8px;
    font-weight:900;
    font-size:13px;
    color: var(--status-color) !important;
  }
  #${POPOVER_ID} .dot{
    width:6px; height:6px;
    border-radius:999px !important;
    background: var(--status-color);
    box-shadow: 0 0 8px var(--status-color);
  }
  #${POPOVER_ID} .count{
    font-size:12px;
    font-weight:900;
    color: var(--boj-muted);
  }
  #${POPOVER_ID} .bojBtn{
    padding: 4px 12px;
    border-radius: calc(var(--boj-radius) - 12px) !important;
    border: 1px solid var(--boj-border);
    background: var(--boj-surface);
    color: var(--boj-text);
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: .18s;
  }
  #${POPOVER_ID} .bojBtn:hover{ background: var(--boj-text); color: var(--boj-surface); }

  #${POPOVER_ID} .chips{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    max-height: 120px;
    overflow:auto;
    padding-right:2px;
    scrollbar-width: thin;
  }
  #${POPOVER_ID} .chips::-webkit-scrollbar { width: 8px; }
  #${POPOVER_ID} .chips::-webkit-scrollbar-thumb {
    background: rgba(148,163,184,.35);
    border-radius: 999px !important;
  }
  #${POPOVER_ID} .chip{
    padding: 6px 10px;
    border-radius: 999px !important;
    border: 1px solid var(--boj-border);
    background: rgba(255,255,255,.35);
    color: var(--boj-text);
    font-size: 11px;
    font-weight: 800;
    opacity: .92;
    transition: transform .12s ease, background .12s ease;
  }
  #${POPOVER_ID} .chip:hover{
    background: rgba(248,250,252,.7);
    transform: translateY(-1px);
  }
  @media (prefers-color-scheme: dark){
    #${POPOVER_ID} .chip{ background: rgba(2,6,23,.22); }
    #${POPOVER_ID} .chip:hover{ background: rgba(30,41,59,.5); }
  }
  #${POPOVER_ID} .empty{
    font-size: 11px;
    font-weight: 800;
    color: var(--boj-muted);
    opacity:.6;
  }

  #${POPOVER_ID} .bojBtn:focus-visible,
  #${POPOVER_ID} .bojClose:focus-visible {
    outline: 3px solid rgba(99,102,241,.35);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce){
    #${POPOVER_ID}{ animation:none; }
    .boj-badge{ transition:none; }
  }

  #boj-status-popover-problem .chip,
#boj-status-popover .chip{
  text-decoration: none;
}
#boj-status-popover-problem .chip:visited,
#boj-status-popover .chip:visited{
  color: inherit;
}

`;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
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

  function parseAllHandles(data) {
    // user:* 키를 전부 수집 (대소문자 혼재 대비: 소문자로 통일)
    const map = new Map(); // lower -> originalKey
    for (const k of Object.keys(data)) {
      if (!k.startsWith("user:")) continue;
      const raw = k.slice(5);
      const lower = norm(raw);
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
      // 선택이 비어있으면 UX상 전체로 fallback
      return uniq.length ? uniq : all;
    }

    // single
    const h = norm(data.activeHandle);
    return h ? [h] : all;
  }

  function buildRecByHandle(data, handleMap, handles) {
    // 대소문자 혼재 키가 있으면 user:<lower>로 한 번 이관(복사)해 둠
    const migrate = {};
    const recBy = {};

    for (const h of handles) {
      const canonicalKey = `user:${h}`;
      const storedKey = handleMap.get(h); // 실제 존재하는 키(대소문자 혼재 포함)
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

    if (Object.keys(migrate).length) {
      chrome.storage.local.set(migrate);
    }
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

  function singleLabelFromBreakdown(bd) {
    if (bd.AC.length) return { text: "AC", cls: "ac" };
    if (bd.PA.length) return { text: "부분점수", cls: "pa" };
    if (bd.TRIED.length) return { text: "시도", cls: "tried" };
    if (bd.NODATA.length) return { text: "데이터없음", cls: "none" };
    return { text: "미시도", cls: "none" };
  }

  function summaryLabelFromBreakdown(bd) {
    const ac = bd.AC.length;
    const pa = bd.PA.length;
    const tr = bd.TRIED.length;
    const no = bd.NONE.length;
    const nd = bd.NODATA.length;

    let text = `AC${ac}·PA${pa}·시${tr}·미${no}`;
    if (nd) text += `·?${nd}`;

    // 색상은 "mix"로 통일 (요약)
    return { text, cls: "mix" };
  }

  function upsertBadge(anchor, pid, labelObj, title) {
    if (!anchor) return;
    let badge = anchor.nextElementSibling;
    if (!badge || !badge.classList || !badge.classList.contains("boj-badge")) {
      badge = document.createElement("span");
      badge.className = "boj-badge";
      anchor.insertAdjacentElement("afterend", badge);
    }
    badge.dataset.pid = pid;
    badge.textContent = labelObj.text;
    badge.title = title || labelObj.text;
    badge.classList.remove("ac", "pa", "tried", "none", "mix");
    badge.classList.add(labelObj.cls);
  }

  function closePopover() {
    const pop = document.getElementById(POPOVER_ID);
    if (pop) pop.remove();
  }

  function openPopover(targetEl, pid) {
    closePopover();

    const bd = breakdownByPid.get(pid);
    if (!bd) return;

    const pop = document.createElement("div");
    pop.id = POPOVER_ID;
    pop.dataset.pid = pid;

    const total = handlesInScope.length;

    const head = document.createElement("div");
    head.className = "bojHead";
    head.innerHTML = `
    <div>
      <div class="bojTitle">✨ 현황 대시보드</div>
      <div class="bojSub">Problem ${pid} · Target: ${total} members</div>
    </div>
    <button class="bojClose" type="button" aria-label="닫기">✕</button>
  `;
    pop.appendChild(head);

    const content = document.createElement("div");
    content.className = "bojContent";

    const rows = [
      { key: "AC", label: "Solved", tone: "tone-ac", arr: bd.AC },
      { key: "PA", label: "Partial", tone: "tone-pa", arr: bd.PA },
      { key: "TRIED", label: "Attempted", tone: "tone-tried", arr: bd.TRIED },
      { key: "NONE", label: "Idle", tone: "tone-none", arr: bd.NONE },
      { key: "NODATA", label: "No data", tone: "tone-nodata", arr: bd.NODATA },
    ];

    rows.forEach((r) => {
      const sec = document.createElement("div");
      sec.className = `bojSection ${r.tone}`;

      sec.innerHTML = `
      <div class="bojSectionHead">
        <div class="bojLabel"><span class="dot"></span>${r.label}</div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="count">${r.arr.length}</span>
          <button class="bojBtn" type="button" data-copy="${r.key}">Copy</button>
        </div>
      </div>
    `;

      const chipsWrap = document.createElement("div");
      chipsWrap.className = "chips";

      if (!r.arr.length) {
        const empty = document.createElement("span");
        empty.className = "empty";
        empty.textContent = "Empty";
        chipsWrap.appendChild(empty);
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
      content.appendChild(sec);
    });

    pop.appendChild(content);
    document.body.appendChild(pop);

    // 위치 확인 (기존 로직 유지)
    const rect = targetEl.getBoundingClientRect();
    const margin = 8;
    const top = rect.bottom + window.scrollY + 6;
    const maxLeft =
      window.scrollX +
      document.documentElement.clientWidth -
      pop.offsetWidth -
      margin;
    const left = Math.min(
      rect.left + window.scrollX,
      Math.max(margin, maxLeft)
    );
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  function scanAndRender(handles, recByHandle) {
    breakdownByPid = new Map();
    handlesInScope = handles;

    const anchors = document.querySelectorAll(LINK_SELECTOR);
    const seenPid = new Set();

    anchors.forEach((a) => {
      const pid = extractPid(a);
      if (!pid) return;
      if (seenPid.has(pid)) return;
      seenPid.add(pid);

      const bd = makeBreakdown(pid, handles, recByHandle);
      breakdownByPid.set(pid, bd);

      const labelObj =
        handles.length <= 1
          ? singleLabelFromBreakdown(bd)
          : summaryLabelFromBreakdown(bd);

      const title =
        handles.length <= 1
          ? `${handles[0] || ""} — ${labelObj.text}`
          : `AC ${bd.AC.length} · PA ${bd.PA.length} · 시도 ${
              bd.TRIED.length
            } · 미시도 ${bd.NONE.length}${
              bd.NODATA.length ? ` · 데이터없음 ${bd.NODATA.length}` : ""
            }`;

      upsertBadge(a, pid, labelObj, title);
    });
  }

  const run = () => {
    safeStorageGet(null, (data) => {
      const allHandleMap = parseAllHandles(data);
      const handles = getHandlesInScope(data, allHandleMap);

      ensureStyle();

      if (!handles.length) {
        // 표시할 학생이 없는 경우: 배지만 만들지 않음
        return;
      }

      const recByHandle = buildRecByHandle(data, allHandleMap, handles);
      scanAndRender(handles, recByHandle);
    });
  };

  // 클릭 이벤트(위임) - 팝오버 열기/복사/닫기
  document.addEventListener("click", (e) => {
    const pop = document.getElementById(POPOVER_ID);

    // 팝오버 내부 버튼들
    // (기존) if (e.target.classList.contains("close")) { ... }
    // (기존) if (copyKey) { pid를 .title에서 파싱 ... }

    if (pop && pop.contains(e.target)) {
      if (e.target.classList.contains("bojClose")) {
        closePopover();
        return;
      }

      const copyBtn = e.target.closest?.("[data-copy]");
      const copyKey = copyBtn?.getAttribute("data-copy");
      if (copyKey) {
        const pid = pop.dataset.pid;
        const bd = pid ? breakdownByPid.get(pid) : null;
        if (!bd) return;
        const arr = bd[copyKey] || [];
        navigator.clipboard.writeText(arr.join("\n")).catch(() => {});
        return;
      }
      return;
    }

    // 팝오버 밖 클릭: 닫기
    if (pop && !pop.contains(e.target)) closePopover();

    // 배지 클릭: 열기
    const badge = e.target.closest && e.target.closest(".boj-badge");
    if (!badge) return;
    const pid = badge.dataset.pid;
    if (!pid) return;
    openPopover(badge, pid);
  });

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
