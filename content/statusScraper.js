(() => {
  const url = new URL(location.href);
  const handle = url.searchParams.get("user_id");
  if (!handle) return;

  function detectVerdictText(row) {
    const el = row.querySelector(".result, .status, .verdict, td[title]");
    let t = el ? el.textContent || el.getAttribute("title") || "" : "";
    if (!t) {
      const tds = [...row.querySelectorAll("td")];
      t = tds.map((td) => td.textContent.trim()).join(" ");
    }
    return t;
  }

  // 기존 mapVerdict 교체
  function mapVerdict(text) {
    const t = (text || "").replace(/\s+/g, " ").trim();
    if (/(맞았습니다!?|Accepted)/i.test(t)) return "AC";
    if (/(부분\s*점수|Partial|Partially Accepted|PA)/i.test(t)) return "PA";
    if (/(틀렸|Wrong)/i.test(t)) return "WA";
    if (/(시간\s*제한|Time Limit)/i.test(t)) return "TLE";
    if (/(메모리\s*초과|Memory Limit)/i.test(t)) return "MLE";
    if (/(컴파일|Compile)/i.test(t)) return "CE";
    if (/(런타임|Runtime)/i.test(t)) return "RE";
    if (/(출력\s*형식|Presentation)/i.test(t)) return "PE";
    if (/(채점\s*중|Judging)/i.test(t)) return "JUDGING";
    return "OTHER";
  }

  const rows = [...document.querySelectorAll("table tr")];
  const updates = {};
  for (const tr of rows) {
    const a = tr.querySelector('a[href^="/problem/"]');
    if (!a) continue;
    const m = a.getAttribute("href").match(/\/problem\/(\d+)/);
    if (!m) continue;
    const pid = m[1];
    const vt = mapVerdict(detectVerdictText(tr));
    updates[pid] = vt;
  }

  if (Object.keys(updates).length === 0) return;

  chrome.storage.local.get(null, (data) => {
    const key = `user:${handle}`;
    const cur = data[key] || { solved: {}, attempts: {}, updatedAt: 0 };
    const now = Date.now();

    for (const [pid, vt] of Object.entries(updates)) {
      if (vt === "AC") {
        cur.solved[pid] = true;
        delete cur.attempts[pid];
      } else if (!cur.solved[pid]) {
        cur.attempts[pid] = { verdict: vt, ts: now };
      }
    }

    cur.updatedAt = now;
    chrome.storage.local.set({ [key]: cur, activeHandle: handle });
  });
})();
