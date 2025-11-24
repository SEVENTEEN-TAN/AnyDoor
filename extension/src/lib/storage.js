// 使用方法：在后台（Service Worker）中调用，需有 "scripting" 权限。
// MVP：仅同步 localStorage；写回前清空 Cookie 与本地缓存（localStorage/sessionStorage/IndexedDB/Cache/ServiceWorker）。

export async function snapshotLocalStorage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      try {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          entries.push({ key: k, value: localStorage.getItem(k) });
        }
        return { ok: true, localStorage: entries };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
  });
  if (!result?.ok) return { localStorage: [] };
  return { localStorage: result.localStorage || [] };
}

export async function snapshotSessionStorage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      try {
        const entries = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          entries.push({ key: k, value: sessionStorage.getItem(k) });
        }
        return { ok: true, sessionStorage: entries };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
  });
  if (!result?.ok) return { sessionStorage: [] };
  return { sessionStorage: result.sessionStorage || [] };
}

export async function clearOriginStorage(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async () => {
      try {
        localStorage.clear();
      } catch (_) {}
      try {
        sessionStorage.clear();
      } catch (_) {}
      try {
        if (self.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}
      try {
        if (self.indexedDB && indexedDB.databases) {
          const dbs = await indexedDB.databases();
          await Promise.all((dbs || []).map(db => new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          })));
        }
      } catch (_) {}
      try {
        if (navigator.serviceWorker) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister().catch(() => {})));
        }
      } catch (_) {}
      return true;
    },
  });
}

export async function clearBasicStorage(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      try { localStorage.clear(); } catch (_) {}
      try { sessionStorage.clear(); } catch (_) {}
      return true;
    },
  });
}

export async function applyLocalStorage(tabId, entries) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [entries || []],
    func: (items) => {
      try {
        for (const { key, value } of items) {
          try { localStorage.setItem(key, value); } catch (_) {}
        }
        return true;
      } catch (_) { return false; }
    },
  });
}

export async function applySessionStorage(tabId, entries) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [entries || []],
    func: (items) => {
      try {
        sessionStorage.clear();
        for (const { key, value } of items) {
          try { sessionStorage.setItem(key, value); } catch (_) {}
        }
        return true;
      } catch (_) { return false; }
    },
  });
}
