(() => {
  const url = new URL(location.href);
  const handle = url.searchParams.get("user_id");
  if (!handle) return;

  function detectVerdictText(row) {
    const el = row.querySelector(".result, .status, .verdict, td[title]");
    let t = el ? (el.textContent || el.getAttribute("title") || "") : "";
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

    chrome.storage.local.get(null, (data) => {
      const key = `user:${handle}`;
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
      chrome.storage.local.set({ [key]: cur, lastScrapedHandle: handle });
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
