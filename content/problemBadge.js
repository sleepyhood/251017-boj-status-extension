(() => {
  const m = location.pathname.match(/\/problem\/(\d+)/);
  if (!m) return;
  const pid = m[1];

  function render(text, detail) {
    const id = "boj-status-badge";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      Object.assign(el.style, {
        position: "fixed",
        top: "12px",
        right: "12px",
        padding: "6px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "600",
        boxShadow: "0 2px 8px rgba(0,0,0,.15)",
        zIndex: 9999,
        userSelect: "none",
      });
      document.body.appendChild(el);
    }
    el.textContent = text + (detail ? ` · ${detail}` : "");
    el.title = "BOJ Status Badges";

    if (/^AC/.test(text)) {
      el.style.background = "#e8f5e9";
      el.style.color = "#1b5e20";
    } else if (/^(시도|Tried)/.test(text)) {
      el.style.background = "#ffebee";
      el.style.color = "#b71c1c";
    }
    // 부분점수 색상
    else if (/^부분점수/.test(text)) {
      el.style.background = "#fff8e1";
      el.style.color = "#e65100";
    } else {
      el.style.background = "#eceff1";
      el.style.color = "#37474f";
    }
  }

  chrome.storage.local.get(null, (data) => {
    const handle = (data.activeHandle || "").trim().toLowerCase();
    if (!handle) {
      render("핸들을 설정하세요", "확장 아이콘 클릭");
      return;
    }
    // const rec = data[`user:${handle}`];
    let rec = data[`user:${handle}`];

if (!rec) {
const foundKey = Object.keys(data).find(
(k) => k.startsWith("user:") && k.slice(5).toLowerCase() === handle
);

if (foundKey) {
rec = data[foundKey];

chrome.storage.local.set({ [`user:${handle}`]: rec }, () => {
});

}
} 

    if (!rec) {
      render("데이터 없음", handle);
      return;
    }
    // 데이터 표시 로직
    if (rec.solved && rec.solved[pid]) {
      render("AC", handle);
    } else if (rec.attempts && rec.attempts[pid]) {
      const vt = rec.attempts[pid].verdict;
      if (vt === "PA") {
        render("부분점수", `${handle}/PA`);
      } else {
        render("시도함", `${handle}/${vt}`);
      }
    } else {
      render("미시도", handle);
    }
  });
})();
