(() => {
  const parts = location.pathname.split("/").filter(Boolean);
  const handle = decodeURIComponent(parts[1] || ""); // /user/<handle>
  if (!handle) return;

  const RE_SOLVED = /맞은\s*문제|Solved/i;
  const RE_PARTIAL = /맞았지만\s*만점을\s*받지\s*못한\s*문제|부분\s*점수|Partial/i;
  const RE_TRIED = /시도했지만\s*맞지\s*못한\s*문제|Tried/i;

  function collectIdsByHeaderRegex(headerRegex) {
    const ids = new Set();

    // '맞은 문제' 같은 텍스트를 가진 후보 헤더들 찾기
    const candidates = [...document.querySelectorAll("h1,h2,h3,h4,strong,span,div,a")].filter(
      (el) => headerRegex.test((el.textContent || "").trim())
    );

    for (const el of candidates) {
      // nextElementSibling이 생길 때까지 위로 올라가며 기준점을 잡음(중첩 구조 대응)
      let base = el;
      while (base && !base.nextElementSibling) base = base.parentElement;
      if (!base) continue;

      // 다음 헤딩(H1~H4)이 나오기 전까지 sibling들을 훑어서 /problem/<id> 링크 수집
      let node = base.nextElementSibling;
      while (node) {
        if (/^H[1-4]$/i.test(node.tagName)) break;

        node.querySelectorAll?.('a[href^="/problem/"]').forEach((a) => {
          const m = a.getAttribute("href")?.match(/\/problem\/(\d+)/);
          if (m) ids.add(m[1]);
        });

        node = node.nextElementSibling;
      }

      // 하나라도 잡혔으면 과도 스캔 방지(동일 섹션 반복 후보 많을 때)
      if (ids.size > 0) break;
    }

    return ids;
  }

  function save() {
    const solvedIds = collectIdsByHeaderRegex(RE_SOLVED);
    const partialIds = collectIdsByHeaderRegex(RE_PARTIAL);
    const triedIds = collectIdsByHeaderRegex(RE_TRIED);

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
        if (!cur.solved[pid] && !cur.attempts[pid]) cur.attempts[pid] = { verdict: "TRIED", ts: now };
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
