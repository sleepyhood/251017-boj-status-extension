document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("handle");
  const save = document.getElementById("save");
  const clearBtn = document.getElementById("clear");
  const modeSel = document.getElementById("mode");

  chrome.storage.local.get(["activeHandle", "badgeMode"], (data) => {
    if (data.activeHandle) input.value = data.activeHandle;
    modeSel.value = data.badgeMode || "single";
  });

  modeSel.addEventListener("change", () => {
    chrome.storage.local.set({ badgeMode: modeSel.value });
  });

  save.addEventListener("click", () => {
    const handle = input.value.trim().toLowerCase();
    if (!handle) return;
    chrome.storage.local.set({ activeHandle: handle }, () => window.close());
  });

  clearBtn.addEventListener("click", () => {
    const handle = input.value.trim().toLowerCase();
    if (!handle) return;
    chrome.storage.local.remove(`user:${handle}`, () => window.close());
  });
});
