document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("handle");
  const save = document.getElementById("save");
  const clearBtn = document.getElementById("clear");

  chrome.storage.local.get(["activeHandle"], (data) => {
    if (data.activeHandle) input.value = data.activeHandle;
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
