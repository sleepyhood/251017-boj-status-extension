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

    chrome.storage.local.get(["selectedHandles", "activeHandle"], (data) => {
      const keysToRemove = [`user:${handle}`];

      // activeHandle이 동일하면 같이 제거
      if ((data.activeHandle || "").trim().toLowerCase() === handle) {
        keysToRemove.push("activeHandle");
      }

      // selectedHandles에서도 제거
      const sel = Array.isArray(data.selectedHandles)
        ? data.selectedHandles
            .map((x) => (x || "").trim().toLowerCase())
            .filter(Boolean)
        : [];
      const newSel = sel.filter((x) => x !== handle);

      chrome.storage.local.remove(keysToRemove, () => {
        if (sel.length !== newSel.length) {
          chrome.storage.local.set({ selectedHandles: newSel }, () =>
            window.close()
          );
        } else {
          window.close();
        }
      });
    });
  });
});
