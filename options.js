function parseHandlesFromStorageKeys(keys) {
  const set = new Set();
  keys.forEach((k) => {
    const m = k.match(/^user:(.+)$/);
    if (m) set.add(m[1]);
  });
  return [...set];
}

function load() {
  chrome.storage.local.get(null, (data) => {
    const tbody = document.querySelector("#tbl tbody");
    tbody.innerHTML = "";
    const handles = parseHandlesFromStorageKeys(Object.keys(data));
    handles.forEach((h) => {
      const rec = data[`user:${h}`] || { solved: {}, attempts: {} };
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${h}</td>
        <td>${Object.keys(rec.solved || {}).length}</td>
        <td>${Object.keys(rec.attempts || {}).length}</td>
        <td><button data-h="${h}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.addEventListener(
      "click",
      (e) => {
        if (e.target.tagName === "BUTTON") {
          const h = e.target.getAttribute("data-h");
          chrome.storage.local.remove(`user:${h}`, load);
        }
      },
      { once: true }
    );
  });
}

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
    } catch (err) {
      alert("Invalid JSON");
    }
  };
  reader.readAsText(f);
});

document.addEventListener("DOMContentLoaded", load);
