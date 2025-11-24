// 使用方法：由 popup 发送消息 {type:"upload"|"writeback", bundleId?} 触发。
// 说明：核心流程：采集 → 上传完整数据；或 writeback → 原封不动回写 Cookies 和 Storage。

import { uploadBundle, writeback as apiWriteback } from "../lib/api.js";
import { collectCookies, writeCookies, clearAllCookies } from "../lib/cookies.js";
import { getETLD1 } from "../lib/etld1.js";
import { snapshotLocalStorage, snapshotSessionStorage, clearBasicStorage, applyLocalStorage, applySessionStorage } from "../lib/storage.js";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "upload-collect") {
      // 第一阶段：仅采集数据，不上传
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const url = new URL(tab.url || "http://localhost");
      const host = url.hostname;
      const etld1 = getETLD1(host);
      console.log("[bg] upload-collect start " + JSON.stringify({ host, etld1, tabUrl: tab.url }));

      // 采集完整数据（不过滤）
      const cookies = await collectCookies(host, etld1);

      // 同步 localStorage + sessionStorage
      const localSnap = await snapshotLocalStorage(tab.id);
      const sessSnap = await snapshotSessionStorage(tab.id);
      const storage = { ...localSnap, ...sessSnap };

      console.log("[bg] upload-collect done: " + JSON.stringify({
        cookies: cookies.length,
        storageLocal: localSnap?.localStorage?.length || 0,
        storageSession: sessSnap?.sessionStorage?.length || 0
      }));

      // 返回采集的数据（不上传）
      sendResponse({ ok: true, host, etld1, cookies, storage });

    } else if (msg?.type === "upload-confirm") {
      // 第二阶段：接收用户确认的数据并上传
      const { name, groupId, shareMode, description, tags, expireDays, host, etld1, cookies, storage } = msg;

      console.log("[bg] upload-confirm start: " + JSON.stringify({
        name,
        groupId: groupId || "默认组",
        shareMode: shareMode || "GROUP_ONLY",
        expireDays,
        host,
        cookieCount: cookies?.length || 0
      }));

      // 构建上传 payload
      const payload = {
        name,
        groupId: groupId || null,
        shareMode: shareMode || "GROUP_ONLY",
        description: description || null,
        tags: tags || null,
        expireDays: expireDays || 7,
        host,
        etld1,
        cookies,
        storage
      };

      // 上传到后端
      const result = await uploadBundle(payload);
      console.log("[bg] upload-confirm success: " + JSON.stringify({
        bundleId: result.bundleId,
        name: result.name,
        shareMode: result.shareMode,
        expireAt: result.expireAt
      }));

      sendResponse({
        ok: true,
        bundleId: result.bundleId,
        name: result.name,
        shareMode: result.shareMode,
        expireAt: result.expireAt,
        count: result.count || (cookies?.length || 0)
      });

    } else if (msg?.type === "upload") {
      // 保留旧的 upload 接口以保持向后兼容
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const url = new URL(tab.url || "http://localhost");
      const host = url.hostname;
      const etld1 = getETLD1(host);
      console.log("[bg] upload start " + JSON.stringify({ host, etld1, tabUrl: tab.url }));
      // 采集完整数据（不过滤）
      const cookies = await collectCookies(host, etld1);
      // 同步 localStorage + sessionStorage
      const localSnap = await snapshotLocalStorage(tab.id);
      const sessSnap = await snapshotSessionStorage(tab.id);
      const storage = { ...localSnap, ...sessSnap };
      console.log("[bg] upload collected (完整数据，未过滤): " + JSON.stringify({
        cookies: cookies.length,
        storageLocal: localSnap?.localStorage?.length || 0,
        storageSession: sessSnap?.sessionStorage?.length || 0
      }));
      // 上传完整数据，确保原封不动地备份
      const { bundleId, expireAt } = await uploadBundle({ host, etld1, cookies, storage });
      console.log("[bg] upload success: " + JSON.stringify({ bundleId, cookies: cookies.length }));
      sendResponse({ ok: true, bundleId, expireAt, count: cookies.length });
    } else if (msg?.type === "writeback") {
      const { bundleId } = msg;
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const data = await apiWriteback(bundleId);
      const url = new URL(tab.url || "http://localhost");
      const host = data.host || url.hostname;
      const etld1 = data.etld1 || getETLD1(host);
      console.log("[bg] writeback start " + JSON.stringify({
        host,
        etld1,
        tabUrl: tab.url,
        cookies: (data.cookies||[]).length,
        storageLocal: data.storage?.localStorage?.length || 0,
        storageSession: data.storage?.sessionStorage?.length || 0  // 添加 sessionStorage 日志
      }));
      // 先清空 Cookie 与本地缓存
      await clearAllCookies(host, etld1, tab.url);
      await clearBasicStorage(tab.id);
      // 分组按目标 host（子域）分别写入，自动选择 https/http
      const allCookies = Array.isArray(data.cookies) ? data.cookies : [];
      const groups = {};
      for (const c of allCookies) {
        // 修复：明确处理 hostOnly 和 domain cookie
        // hostOnly cookie：domain 字段是精确的 host（如 "www.example.com"）
        // domain cookie：domain 字段可能带前缀点（如 ".example.com"）
        const dom = (c.domain || host || "").replace(/^\./, "");
        // 使用去点后的 domain 作为分组 key，确保同域的 Cookie 在一组
        const key = dom;
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      }
      console.log("[bg] cookie groups: " + JSON.stringify({
        groupCount: Object.keys(groups).length,
        groups: Object.keys(groups).map(k => ({ host: k, count: groups[k].length }))
      }));
      let totalFail = 0; const detailErrors = [];
      for (const gHost of Object.keys(groups)) {
        const hasSecure = groups[gHost].some(x => !!x.secure);
        const ctxUrl = `${hasSecure ? 'https' : (url.protocol.replace(':','')||'https')}://${gHost}/`;
        console.log("[bg] write group " + JSON.stringify({ host: gHost, count: groups[gHost].length, ctxUrl }));
        const res = await writeCookies(groups[gHost], ctxUrl);
        console.log("[bg] group result " + JSON.stringify({ host: gHost, ok: res.ok, fail: res.fail }));
        totalFail += res.fail;
        if (res.fail > 0) detailErrors.push({ host: gHost, errors: res.errors });
      }
      if (totalFail > 0) {
        console.error("[bg] cookie write failed: " + JSON.stringify({ fail: totalFail, details: detailErrors }));
        sendResponse({ ok: false, error: `cookie write failed: ${totalFail}`, details: detailErrors });
        return;
      }
      // 写入 localStorage 快照
      if (data.storage?.localStorage) {
        await applyLocalStorage(tab.id, data.storage.localStorage);
        console.log("[bg] applied localStorage " + JSON.stringify({ count: data.storage.localStorage.length }));
      }
      if (data.storage?.sessionStorage) {
        await applySessionStorage(tab.id, data.storage.sessionStorage);
        console.log("[bg] applied sessionStorage " + JSON.stringify({ count: data.storage.sessionStorage.length }));
      }
      // 回写后验证数据完整性
      const expectedCount = (data.cookies || []).length;
      const expectedLocalStorage = data.storage?.localStorage?.length || 0;
      const expectedSessionStorage = data.storage?.sessionStorage?.length || 0;

      // 等待 Cookie 写入生效（稍微延迟）
      await new Promise(resolve => setTimeout(resolve, 100));

      const after = await collectCookies(host, etld1);
      const actualCount = after.length;

      // 详细记录验证时的Cookie信息
      console.log("[bg] 验证时读取到的Cookie:");
      for (const c of after) {
        console.log(`  - ${c.name}:`, {
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite,
          expirationDate: c.expirationDate,
          hostOnly: c.hostOnly
        });
      }

      console.log("[bg] 数据同步完整性验证: " + JSON.stringify({
        cookies: { expected: expectedCount, actual: actualCount, match: expectedCount === actualCount },
        localStorage: { expected: expectedLocalStorage },
        sessionStorage: { expected: expectedSessionStorage }
      }));

      // 对比上传和回写的数量
      const cookieMatch = expectedCount === actualCount;
      const syncStatus = cookieMatch ? "✅ 完全同步" : `⚠️ Cookie 不完全匹配（预期 ${expectedCount}，实际 ${actualCount}）`;

      sendResponse({
        ok: true,
        fullSync: cookieMatch,
        syncStatus,
        host: data.host,
        cookies: {
          expected: expectedCount,
          actual: actualCount,
          match: cookieMatch
        },
        storage: {
          localStorage: expectedLocalStorage,
          sessionStorage: expectedSessionStorage
        },
        message: cookieMatch ? "✅ 站点状态已完整同步" : `⚠️ ${syncStatus}，请查看日志`
      });
      // 自动刷新当前标签页，触发站点按新态加载（轻微延迟）
      setTimeout(() => {
        try { chrome.tabs.reload(tab.id); } catch (_) {}
      }, 300);
    } else {
      sendResponse({ ok: false, error: "unknown message" });
    }
  })().catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true; // keep channel open
});
