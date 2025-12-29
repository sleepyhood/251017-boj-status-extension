const norm = (s) => (s || "").trim().toLowerCase();

function formatUpdatedAt(ts) {
  ts = Number(ts || 0);
  if (!ts) return { text: "-", title: "" };

  const now = Date.now();
  const diff = Math.max(0, now - ts);

  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);

  let rel = "";
  if (min < 1) rel = "방금";
  else if (min < 60) rel = `${min}분 전`;
  else if (hour < 24) rel = `${hour}시간 전`;
  else rel = `${day}일 전`;

  return {
    text: rel,
    title: new Date(ts).toLocaleString("ko-KR"),
  };
}

// ===== Import sanitization (minimal validation/whitelisting) =====
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{0,49}$/i; // BOJ handle용(보수적으로)
const PID_RE = /^\d+$/;

const MAX_USERS_IMPORT = 300; // 너무 큰 파일 방지
const MAX_ITEMS_PER_USER = 20000; // solved+attempts 각각 상한(스토리지 폭주 방지)

function isPlainObject(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

function sanitizeHandle(h) {
  const s = norm(h);
  if (!s) return null;
  if (s.length > 50) return null;
  if (!HANDLE_RE.test(s)) return null;
  return s;
}

function sanitizeVerdict(v) {
  // 미래 verdict 확장 대비: A-Z/0-9/_만 허용 + 길이 제한
  const s = String(v || "")
    .trim()
    .toUpperCase();
  if (!s) return "TRIED";
  if (s.length > 12) return "TRIED";
  if (!/^[A-Z0-9_]+$/.test(s)) return "TRIED";
  return s;
}

function sanitizeUserRecord(rawRec) {
  if (!isPlainObject(rawRec)) return null;

  const out = { solved: {}, attempts: {}, updatedAt: 0 };
  // note(메모)
  if (typeof rawRec.note === "string") {
    const t = rawRec.note.trim().slice(0, 80);
    if (t) out.note = t;
  }

  // solved: { "1000": true, ... }
  if (isPlainObject(rawRec.solved)) {
    let cnt = 0;
    for (const [pid, val] of Object.entries(rawRec.solved)) {
      if (cnt >= MAX_ITEMS_PER_USER) break;
      if (!PID_RE.test(pid)) continue;
      if (val) {
        out.solved[pid] = true;
        cnt += 1;
      }
    }
  }

  // attempts: { "1000": { verdict:"WA", ts: 123 }, ... }
  if (isPlainObject(rawRec.attempts)) {
    let cnt = 0;
    for (const [pid, a] of Object.entries(rawRec.attempts)) {
      if (cnt >= MAX_ITEMS_PER_USER) break;
      if (!PID_RE.test(pid)) continue;
      if (!isPlainObject(a)) continue;

      const verdict = sanitizeVerdict(a.verdict);
      const ts = Number(a.ts);
      out.attempts[pid] = {
        verdict,
        ts: Number.isFinite(ts) ? ts : 0,
      };
      cnt += 1;
    }
  }

  const ua = Number(rawRec.updatedAt);
  out.updatedAt = Number.isFinite(ua) ? ua : 0;

  return out;
}

function sanitizeImportPayload(raw) {
  if (!isPlainObject(raw)) {
    return {
      payload: null,
      summary: null,
      error: "Invalid JSON: root must be an object",
    };
  }

  const payload = {};
  const summary = {
    keptKeys: 0,
    droppedKeys: 0,
    usersImported: 0,
    usersDropped: 0,
    usersTruncated: 0,
  };

  // 1) settings keys (whitelist)
  if (typeof raw.badgeMode === "string") {
    const bm = raw.badgeMode.trim();
    if (bm === "single" || bm === "all" || bm === "selected") {
      payload.badgeMode = bm;
      summary.keptKeys += 1;
    } else {
      summary.droppedKeys += 1;
    }
  }

  if (typeof raw.activeHandle === "string") {
    const ah = sanitizeHandle(raw.activeHandle);
    if (ah) {
      payload.activeHandle = ah;
      summary.keptKeys += 1;
    } else {
      summary.droppedKeys += 1;
    }
  }

  if (typeof raw.lastScrapedHandle === "string") {
    const lh = sanitizeHandle(raw.lastScrapedHandle);
    if (lh) {
      payload.lastScrapedHandle = lh;
      summary.keptKeys += 1;
    } else {
      summary.droppedKeys += 1;
    }
  }

  if (Array.isArray(raw.selectedHandles)) {
    const uniq = new Set();
    for (const x of raw.selectedHandles) {
      const h = sanitizeHandle(x);
      if (h) uniq.add(h);
    }
    payload.selectedHandles = Array.from(uniq);
    summary.keptKeys += 1;
  }

  // 2) user:* records
  const userKeys = Object.keys(raw).filter((k) => k.startsWith("user:"));
  let imported = 0;

  for (const k of userKeys) {
    if (imported >= MAX_USERS_IMPORT) {
      summary.usersTruncated = userKeys.length - imported;
      break;
    }

    const handle = sanitizeHandle(k.slice(5));
    if (!handle) {
      summary.usersDropped += 1;
      continue;
    }

    const rec = sanitizeUserRecord(raw[k]);
    if (!rec) {
      summary.usersDropped += 1;
      continue;
    }

    payload[`user:${handle}`] = rec;
    summary.usersImported += 1;
    imported += 1;
  }

  // 아무 것도 유효하지 않으면 실패로 처리
  const hasAny =
    Object.keys(payload).length > 0 &&
    (summary.usersImported > 0 ||
      "badgeMode" in payload ||
      "activeHandle" in payload ||
      "selectedHandles" in payload ||
      "lastScrapedHandle" in payload);

  if (!hasAny) {
    return {
      payload: null,
      summary: null,
      error: "Import failed: no valid keys found in JSON",
    };
  }

  return { payload, summary, error: null };
}
// ===== /Import sanitization =====

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

      // 1) Include checkbox
      const tdInc = document.createElement("td");
      const cb = document.createElement("input");
      cb.className = "include";
      cb.type = "checkbox";
      cb.dataset.h = h;
      cb.checked = selected.has(h);
      tdInc.appendChild(cb);

      // 2) Handle
      const tdHandle = document.createElement("td");
      const a = document.createElement("a");
      a.className = "handle-link";
      a.href = `https://www.acmicpc.net/user/${encodeURIComponent(h)}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = h;
      tdHandle.appendChild(a);
      //tdHandle.textContent = h;
      // 3) Memo
      const tdMemo = document.createElement("td");
      const memo = document.createElement("input");
      memo.type = "text";
      memo.className = "memo";
      memo.dataset.h = h;
      memo.placeholder = "이름/메모";
      memo.value = typeof rec.note === "string" ? rec.note : "";
      tdMemo.appendChild(memo);

      // 3) Solved count
      const tdSolved = document.createElement("td");
      tdSolved.textContent = String(Object.keys(rec.solved || {}).length);

      // 4) Attempted count
      const tdAttempted = document.createElement("td");
      tdAttempted.textContent = String(Object.keys(rec.attempts || {}).length);

      // 5) Last Updated
      const tdUpdated = document.createElement("td");
      const fmt = formatUpdatedAt(rec.updatedAt);
      tdUpdated.textContent = fmt.text;
      if (fmt.title) tdUpdated.title = fmt.title;

      // 5) Actions (Delete)
      const tdAct = document.createElement("td");
      tdAct.style.textAlign = "right"; // ✅ 헤더와 일치
      tdAct.style.whiteSpace = "nowrap";

      const delBtn = document.createElement("button");
      delBtn.className = "del";
      delBtn.type = "button";
      delBtn.dataset.h = h;
      delBtn.textContent = "Delete";
      tdAct.appendChild(delBtn);

      // append
      tr.append(
        tdInc,
        tdHandle,
        tdMemo,
        tdSolved,
        tdAttempted,
        tdUpdated,
        tdAct
      );
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

  // memo 저장(위임, 디바운스)
  const memoTimers = new Map();

  tbody.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.classList.contains("memo")) return;

    const h = norm(el.getAttribute("data-h"));
    if (!h) return;

    const value = (el.value || "").trim().slice(0, 80); // 길이 제한(예: 80자)

    // 디바운스
    if (memoTimers.has(h)) clearTimeout(memoTimers.get(h));
    memoTimers.set(
      h,
      setTimeout(() => {
        const key = `user:${h}`;
        chrome.storage.local.get([key], (data) => {
          const cur = data[key] || { solved: {}, attempts: {}, updatedAt: 0 };
          if (value) cur.note = value;
          else delete cur.note;
          chrome.storage.local.set({ [key]: cur });
        });
        memoTimers.delete(h);
      }, 300)
    );
  });

  // include 체크 변경(위임)
  // include 체크 변경(위임) - selectedHandles만 토글
  tbody.addEventListener("change", (e) => {
    const cb = e.target;
    if (!cb.classList.contains("include")) return;

    const h = norm(cb.getAttribute("data-h"));
    if (!h) return;

    chrome.storage.local.get(["selectedHandles"], (data) => {
      const sel = new Set(
        Array.isArray(data.selectedHandles)
          ? data.selectedHandles.map(norm).filter(Boolean)
          : []
      );

      if (cb.checked) sel.add(h);
      else sel.delete(h);

      chrome.storage.local.set({ selectedHandles: [...sel].sort() }, load);
    });
  });

  // 삭제 버튼(위임)
  // 삭제 버튼(위임) - user 데이터 삭제 + selectedHandles/activeHandle 정리
  tbody.addEventListener("click", (e) => {
    const btn = e.target;
    if (!btn.classList.contains("del")) return;

    const h = norm(btn.getAttribute("data-h"));
    if (!h) return;

    chrome.storage.local.get(["selectedHandles", "activeHandle"], (data) => {
      const keysToRemove = [`user:${h}`];

      if (norm(data.activeHandle) === h) keysToRemove.push("activeHandle");

      const sel = Array.isArray(data.selectedHandles)
        ? data.selectedHandles.map(norm).filter(Boolean)
        : [];
      const newSel = sel.filter((x) => x !== h);

      chrome.storage.local.remove(keysToRemove, () => {
        if (sel.length !== newSel.length) {
          chrome.storage.local.set({ selectedHandles: newSel }, load);
        } else {
          load();
        }
      });
    });
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
        const raw = JSON.parse(reader.result);

        const { payload, summary, error } = sanitizeImportPayload(raw);
        if (error) {
          alert(error);
          return;
        }

        // 기존 데이터 유지(merge) + 안전한 키만 반영
        chrome.storage.local.set(payload, () => {
          load();
          alert(
            `Import OK\n- users: ${summary.usersImported} (dropped: ${summary.usersDropped}, truncated: ${summary.usersTruncated})`
          );
        });
      } catch {
        alert("Invalid JSON");
      }
    };

    reader.readAsText(f);
  });

  load();

  // 토스트에서 넘어온 경우: 특정 섹션으로 스크롤
  chrome.storage.local.get(["__boj_options_jump"], (d) => {
    const id = d.__boj_options_jump;
    if (!id) return;

    chrome.storage.local.remove(["__boj_options_jump"], () => {
      // load()로 테이블 렌더 후 스크롤되도록 약간 지연
      setTimeout(() => {
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    });
  });
});
