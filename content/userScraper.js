(() => {
  const parts = location.pathname.split("/").filter(Boolean);
  const handle = decodeURIComponent(parts[1] || "")
    .trim()
    .toLowerCase();
  if (!handle) return;

  // ✅ "제목(섹션 헤더)"만 매칭되도록 앵커 처리 (+ (숫자) 같은 카운트가 붙는 경우 허용)
  // ✅ "섹션 제목"에만 매칭되도록 앵커(^$) + 카운트( (123) ) 허용
// ✅ title 텍스트 뒤에 카운트가 " (123)" 또는 " 123"로 붙어도 매칭되게
  const RE_SOLVED_TITLE =
    /^(맞은\s*문제|Solved(\s*Problems?)?)(\s*(\(\d+\)|\d+))?$/i;

  const RE_PARTIAL_TITLE =
    /^(맞았지만\s*만점을\s*받지\s*못한\s*문제|부분\s*점수|Partial(\s*Problems?)?)(\s*(\(\d+\)|\d+))?$/i;

  const RE_TRIED_TITLE =
    /^(시도했지만\s*맞지\s*못한\s*문제|Tried(\s*Problems?)?)(\s*(\(\d+\)|\d+))?$/i;


function normalizeText(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function collectIdsBySectionTitle(titleRe) {
  const ids = new Set();

  // 1) BOJ 프로필은 보통 bootstrap panel 구조라 여기서 먼저 찾는다
  const panels = [...document.querySelectorAll(".panel")];
  for (const panel of panels) {
    const headingEl =
      panel.querySelector(".panel-heading") ||
      panel.querySelector(".panel-title") ||
      panel.querySelector("h1,h2,h3,h4,strong");

    const title = normalizeText(headingEl?.textContent);
    if (!title) continue;

    if (titleRe.test(title)) {
      const root = panel.querySelector(".panel-body") || panel;
      root.querySelectorAll('a[href^="/problem/"]').forEach((a) => {
        const m = a.getAttribute("href")?.match(/\/problem\/(\d+)/);
        if (m) ids.add(m[1]);
      });
      return ids; // 한 섹션만 찾으면 끝
    }
  }

  // 2) 혹시 panel 구조가 아니면(레이아웃 변경 등) 제한된 헤더 셀렉터로 fallback
  const headingCandidates = [
    ...document.querySelectorAll(".panel-heading,.panel-title,h1,h2,h3,h4,strong"),
  ];

  const h = headingCandidates.find((el) => titleRe.test(normalizeText(el.textContent)));
  const container = h?.closest?.(".panel") || h?.parentElement;
  if (!container) return ids;

  (container.querySelector(".panel-body") || container)
    .querySelectorAll('a[href^="/problem/"]')
    .forEach((a) => {
      const m = a.getAttribute("href")?.match(/\/problem\/(\d+)/);
      if (m) ids.add(m[1]);
    });

  return ids;
}


  function save() {
const solvedIds = collectIdsBySectionTitle(RE_SOLVED_TITLE);
const partialIds = collectIdsBySectionTitle(RE_PARTIAL_TITLE);
const triedIds = collectIdsBySectionTitle(RE_TRIED_TITLE);

// ✅ 안전장치: partial/tried에 잡힌 건 solved에서 제거
partialIds.forEach((pid) => solvedIds.delete(pid));
triedIds.forEach((pid) => solvedIds.delete(pid));

chrome.storage.local.get(null, (data) => {
  const key = `user:${handle}`;
  const prev = data[key] || { solved: {}, attempts: {}, updatedAt: 0 };

  const now = Date.now();

  // ✅ 1) 이번 스크랩을 "정답 스냅샷"으로 반영해서,
  //     과거 버그로 잘못 들어간 solved/attempts가 자동 정정되게 만든다.
  const newSolved = {};
  solvedIds.forEach((pid) => {
    newSolved[pid] = true;
  });

  // attempts는 statusScraper가 더 자세한 verdict(WA/TLE 등)을 넣었을 수도 있으니,
  // "멤버십"은 프로필을 따르되, 기존 verdict가 더 구체적이면 유지
  const prevAttempts = prev.attempts || {};
  const newAttempts = {};

  partialIds.forEach((pid) => {
    if (newSolved[pid]) return;
    const old = prevAttempts[pid];
    newAttempts[pid] = {
      verdict: "PA",                 // 프로필의 의미는 '부분 점수'
      ts: old?.ts || now,
    };
  });

  triedIds.forEach((pid) => {
    if (newSolved[pid]) return;
    const old = prevAttempts[pid];
    newAttempts[pid] = {
      // old.verdict가 WA/TLE/RE 같은 더 구체적인 값이면 유지,
      // 없으면 TRIED로 둔다
      verdict: old?.verdict && old.verdict !== "PA" ? old.verdict : "TRIED",
      ts: old?.ts || now,
    };
  });

  const cur = {
    ...prev,
    solved: newSolved,
    attempts: newAttempts,
    updatedAt: now,
    scrapeMeta: {
      source: "profile",
      solved: solvedIds.size,
      partial: partialIds.size,
      tried: triedIds.size,
      at: now,
    },
  };

  // ✅ 2) 디버그 로그(수집이 실제로 됐는지 확인용)
  console.info("[BOJ Status] profile scrape", {
    handle,
    solved: solvedIds.size,
    partial: partialIds.size,
    tried: triedIds.size,
  });

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
