(() => {
  const parts = location.pathname.split("/").filter(Boolean);
  const handle = decodeURIComponent(parts[1] || "")
    .trim()
    .toLowerCase();
  if (!handle) return;
  // ===== Toast UI (profile page) =====
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
  border-radius: 14px !important;
  border: 1px solid rgba(226,232,240,.8);
  background: rgba(255,255,255,.92);
  color: #1e293b;
  box-shadow: 0 10px 25px rgba(0,0,0,.12);
  backdrop-filter: blur(10px);
  font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
#${TOAST_ID} b{ font-weight: 900; }
#${TOAST_ID} .msg{ display:flex; flex-direction:column; gap:3px; }
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

    // 기존 토스트 제거
    document.getElementById(TOAST_ID)?.remove();

    const wrap = document.createElement("div");
    wrap.id = TOAST_ID;

    const msg = document.createElement("div");
    msg.className = "msg";
    msg.innerHTML = `<div><b>${title}</b></div><div class="sub">${
      subtitle || ""
    }</div>`;

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

    // 자동 닫힘
    window.setTimeout(() => wrap.remove(), 4500);
  }
  // ===== /Toast UI =====

  // ✅ "제목(섹션 헤더)"만 매칭되도록 앵커 처리 (+ (숫자) 같은 카운트가 붙는 경우 허용)
  const RE_SOLVED_TITLE = /^(맞은\s*문제|Solved)(\s*\(\d+\))?$/i;

  const RE_PARTIAL_TITLE =
    /^(맞았지만\s*만점을\s*받지\s*못한\s*문제|부분\s*점수|Partial)(\s*\(\d+\))?$/i;

  const RE_TRIED_TITLE =
    /^(시도했지만\s*맞지\s*못한\s*문제|Tried)(\s*\(\d+\))?$/i;

  function collectIdsBySectionTitle(titleRe, otherTitleRes) {
    const ids = new Set();

    const normText = (s) => (s || "").trim().replace(/\s+/g, " ");

    // 제목 후보는 "헤더처럼 보이는 요소"로 제한 (div/span/a를 빼서 오탐을 크게 줄임)
    const titleCandidates = [
      ...document.querySelectorAll("h1,h2,h3,h4,h5,strong"),
    ].filter((el) => {
      const t = normText(el.textContent);
      if (!t) return false;
      if (t.length > 60) return false; // 너무 긴 텍스트는 헤더일 확률 낮음
      if (!titleRe.test(t)) return false;
      // 헤더 자체에 문제 링크가 들어있으면(리스트 내부) 오탐 가능 → 제외
      if (el.querySelector?.('a[href^="/problem/"]')) return false;
      return true;
    });

    function containerHasOtherTitles(container, selfTitleEl) {
      const nodes = container.querySelectorAll("h1,h2,h3,h4,h5,strong");
      for (const n of nodes) {
        if (n === selfTitleEl) continue;
        const t = normText(n.textContent);
        if (!t) continue;
        if (t.length > 60) continue;
        // 다른 섹션 제목이 같은 컨테이너 안에 보이면, 이 컨테이너는 "너무 큼"
        if (otherTitleRes.some((re) => re.test(t))) return true;
      }
      return false;
    }

    function pickBestContainer(titleEl) {
      // titleEl을 포함하면서 /problem 링크가 있는 "가장 가까운(작은) 컨테이너"를 찾는다.
      // 단, 다른 섹션 제목까지 포함하는 컨테이너가 되면 그 직전(best)을 사용한다.
      let cur = titleEl;
      let best = null;

      while (cur && cur !== document.body) {
        const hasLinks = !!cur.querySelector?.('a[href^="/problem/"]');
        if (hasLinks) best = cur;

        // 컨테이너가 다른 섹션 제목까지 포함해버리면, 직전 best가 정답
        if (containerHasOtherTitles(cur, titleEl)) break;

        cur = cur.parentElement;
      }
      return best;
    }

    for (const titleEl of titleCandidates) {
      const container = pickBestContainer(titleEl);
      if (!container) continue;

      container.querySelectorAll('a[href^="/problem/"]').forEach((a) => {
        const m = a.getAttribute("href")?.match(/\/problem\/(\d+)/);
        if (m) ids.add(m[1]);
      });

      // 한 섹션에서라도 잡혔으면 종료(중복 후보 방지)
      if (ids.size > 0) break;
    }

    return ids;
  }

  function save() {
    function hasSectionTitle(titleRe) {
      const normText = (s) => (s || "").trim().replace(/\s+/g, " ");
      const els = [...document.querySelectorAll("h1,h2,h3,h4,h5,strong")];
      return els.some((el) => {
        const t = normText(el.textContent);
        if (!t || t.length > 60) return false;
        if (!titleRe.test(t)) return false;
        if (el.querySelector?.('a[href^="/problem/"]')) return false;
        return true;
      });
    }

    let done = false;
    let inflight = false;

    function trySave(force = false) {
      if (done || inflight) return;

      const solvedIds = collectIdsBySectionTitle(RE_SOLVED_TITLE, [
        RE_PARTIAL_TITLE,
        RE_TRIED_TITLE,
      ]);
      const partialIds = collectIdsBySectionTitle(RE_PARTIAL_TITLE, [
        RE_SOLVED_TITLE,
        RE_TRIED_TITLE,
      ]);
      const triedIds = collectIdsBySectionTitle(RE_TRIED_TITLE, [
        RE_SOLVED_TITLE,
        RE_PARTIAL_TITLE,
      ]);

      // 섞여 들어온 건 제거
      partialIds.forEach((pid) => solvedIds.delete(pid));
      triedIds.forEach((pid) => solvedIds.delete(pid));

      const anyTitle =
        hasSectionTitle(RE_SOLVED_TITLE) ||
        hasSectionTitle(RE_PARTIAL_TITLE) ||
        hasSectionTitle(RE_TRIED_TITLE);

      // 아직 페이지가 덜 렌더링된 상태면 대기(단, 마지막(force)에는 저장해서 "0개 유저"도 등록)
      if (
        !force &&
        !anyTitle &&
        solvedIds.size + partialIds.size + triedIds.size === 0
      ) {
        return;
      }

      inflight = true;

      chrome.storage.local.get(null, (data) => {
        const key = `user:${handle}`;
        const existed = !!data[key];
        const cur = data[key] || { solved: {}, attempts: {}, updatedAt: 0 };
        const now = Date.now();

        // solved
        solvedIds.forEach((pid) => {
          cur.solved[pid] = true;
          delete cur.attempts[pid];
        });

        // partial (PA)
        partialIds.forEach((pid) => {
          if (!cur.solved[pid]) cur.attempts[pid] = { verdict: "PA", ts: now };
        });

        // tried (TRIED)
        triedIds.forEach((pid) => {
          if (!cur.solved[pid] && !cur.attempts[pid]) {
            cur.attempts[pid] = { verdict: "TRIED", ts: now };
          }
        });

        cur.updatedAt = now;

        chrome.storage.local.set(
          { [key]: cur, lastScrapedHandle: handle },
          () => {
            inflight = false;
            done = true;

            if (!toastShown) {
              toastShown = true;

              const title = existed ? "학생 업데이트 완료" : "학생 추가 완료";
              const sub = `@${handle} · ${new Date(now).toLocaleString(
                "ko-KR"
              )}`;

              // (고민중이던) 학생 목록 바로가기: options로 이동
              showToast(title, sub, {
                actionLabel: "학생 목록",
                onAction: () => {
                  // 옵션에서 어디로 점프할지 저장
                  chrome.storage.local.set(
                    { __boj_options_jump: "students" },
                    () => {
                      // ✅ 크롬이 허용하는 방식으로 옵션 열기
                      if (chrome.runtime?.openOptionsPage)
                        chrome.runtime.openOptionsPage();
                      else
                        window.open(
                          chrome.runtime.getURL("options.html"),
                          "_blank"
                        ); // (구버전 대비)
                    }
                  );
                },
              });
            }
          }
        );
      });
    }

    // user 페이지가 늦게 렌더링되는 케이스 대비: 0.3s 간격 재시도
    let tries = 0;
    const MAX_TRIES = 12;
    const timer = setInterval(() => {
      tries += 1;
      trySave(tries >= MAX_TRIES);
      if (done || tries >= MAX_TRIES) clearInterval(timer);
    }, 300);
  }
  save();
})();
