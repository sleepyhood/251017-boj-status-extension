const norm = (s) => (s || "").trim().toLowerCase();

function parseAllHandles(data) {
  const map = new Map(); // lower -> storedKey
  Object.keys(data).forEach((k) => {
    if (!k.startsWith("user:")) return;
    const lower = norm(k.slice(5));
    if (lower) map.set(lower, k);
  });
  return map;
}

function load() {
  chrome.storage.local.get(null, (data) => {
    const tbody = document.querySelector("#tbl tbody");
    const modeSel = document.getElementById("badgeMode");
    const allMap = parseAllHandles(data);
    const handles = [...allMap.keys()].sort();

    // mode
    modeSel.value = data.badgeMode || "single";

    // selectedHandles
    const selected = new Set(
      Array.isArray(data.selectedHandles)
        ? data.selectedHandles.map(norm).filter(Boolean)
        : []
    );

    tbody.innerHTML = "";
    handles.forEach((h) => {
      const recKey = allMap.get(h) || `user:${h}`;
      const rec = data[`user:${h}`] ||
        data[recKey] || { solved: {}, attempts: {} };

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <input class="include" type="checkbox" data-h="${h}" ${
        selected.has(h) ? "checked" : ""
      }/>
        </td>
        <td>${h}</td>
        <td>${Object.keys(rec.solved || {}).length}</td>
        <td>${Object.keys(rec.attempts || {}).length}</td>
        <td><button class="del" data-h="${h}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// 이벤트 바인딩
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.querySelector("#tbl tbody");
  const modeSel = document.getElementById("badgeMode");

  // 모드 변경 저장
  modeSel.addEventListener("change", () => {
    chrome.storage.local.set({ badgeMode: modeSel.value });
  });

  // include 체크 변경(위임)
  tbody.addEventListener("change", (e) => {
    const cb = e.target;
    if (!cb.classList.contains("include")) return;
    const h = cb.getAttribute("data-h");
    if (!h) return;

    chrome.storage.local.get(["selectedHandles"], (data) => {
      const arr = Array.isArray(data.selectedHandles)
        ? data.selectedHandles.map(norm)
        : [];
      const set = new Set(arr.filter(Boolean));
      if (cb.checked) set.add(h);
      else set.delete(h);
      chrome.storage.local.set({ selectedHandles: [...set] }, load);
    });
  });

  // 삭제 버튼(위임)
  tbody.addEventListener("click", (e) => {
    const btn = e.target;
    if (!btn.classList.contains("del")) return;
    const h = btn.getAttribute("data-h");
    if (!h) return;
    chrome.storage.local.remove(`user:${h}`, load);
  });

  // 전체 선택 / 선택 해제
  document.getElementById("selAll").addEventListener("click", () => {
    chrome.storage.local.get(null, (data) => {
      const allMap = parseAllHandles(data);
      chrome.storage.local.set(
        { selectedHandles: [...allMap.keys()].sort() },
        load
      );
    });
  });

  document.getElementById("selNone").addEventListener("click", () => {
    chrome.storage.local.set({ selectedHandles: [] }, load);
  });

  // Export / Import(기존 유지)
  document.getElementById("export").addEventListener("click", () => {
    chrome.storage.local.get(null, (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "boj-status-local.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  document.getElementById("file").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        chrome.storage.local.set(obj, load);
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(f);
  });

  load();
});
