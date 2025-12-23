(() => {
  const parts = location.pathname.split("/").filter(Boolean);
  const handle = decodeURIComponent(parts[1] || "")
    .trim()
    .toLowerCase();
  if (!handle) return;

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

    // ✅ 안전장치: 섞여 들어온 건 제거(정상이라면 보통 없어야 함)
    partialIds.forEach((pid) => solvedIds.delete(pid));
    triedIds.forEach((pid) => solvedIds.delete(pid));

    chrome.storage.local.get(null, (data) => {
      const key = `user:${handle}`;
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
        if (!cur.solved[pid] && !cur.attempts[pid])
          cur.attempts[pid] = { verdict: "TRIED", ts: now };
      });

      cur.updatedAt = now;

      // ✅ activeHandle은 popup에서만 관리 (여기서 덮어쓰지 않음)
      chrome.storage.local.set({ [key]: cur, lastScrapedHandle: handle });
    });
  }

  // user 페이지가 늦게 렌더링되는 케이스 대비: 0.3s 간격으로 몇 번 재시도
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    save();
    if (tries >= 6) clearInterval(timer);
  }, 300);
})();
