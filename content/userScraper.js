(() => {
  const parts = location.pathname.split("/").filter(Boolean);
  const handle = decodeURIComponent(parts[1] || ""); // /user/<handle>
  if (!handle) return;

  function getSolvedProblemIds() {
    const heads = [...document.querySelectorAll("h2,h3,strong,span")].filter(
      (el) => /맞은\s*문제|Solved/i.test((el.textContent || "").trim())
    );
    const ids = new Set();
    heads.forEach((h) => {
      // 다음 헤딩(H2/H3) 나오기 전까지의 형제 요소들만 스캔
      let node = h.nextElementSibling;
      while (node && !/^H[23]$/i.test(node.tagName)) {
        node.querySelectorAll?.('a[href^="/problem/"]').forEach((a) => {
          const m = a.getAttribute("href")?.match(/\/problem\/(\d+)/);
          if (m) ids.add(m[1]);
        });
        node = node.nextElementSibling;
      }
    });
    return ids;
  }

  const solvedIds = getSolvedProblemIds();
  if (solvedIds.size === 0) return;

  chrome.storage.local.get(null, (data) => {
    const key = `user:${handle}`;
    const cur = data[key] || { solved: {}, attempts: {}, updatedAt: 0 };
    solvedIds.forEach((id) => (cur.solved[id] = true)); // 오직 '맞은 문제'만 solved에 반영
    cur.updatedAt = Date.now();
    chrome.storage.local.set({ [key]: cur, activeHandle: handle });
  });
})();
