// 使用方法：在 background 中调用本模块收集与写回 Cookie。
// 说明：采集按 host 与 eTLD+1 两级过滤；写回先 remove 再 set。

export async function collectCookies(host, etld1) {
  const all = await chrome.cookies.getAll({});
  const matches = all.filter((c) => {
    const d = (c.domain || "").replace(/^\./, "");
    // 修复：使用精确匹配或正确的域名后缀匹配
    // 匹配条件：domain 等于 host/etld1，或者是它们的子域
    return d === host || d === etld1 ||
           d.endsWith("." + host) || d.endsWith("." + etld1);
  });
  console.log("[cookies] collectCookies: " + JSON.stringify({
    total: all.length,
    matched: matches.length,
    host,
    etld1
  }));
  return matches.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expirationDate: c.expirationDate,
    hostOnly: c.hostOnly,
    partitionKey: c.partitionKey || undefined,
    storeId: c.storeId,
  }));
}

export async function writeCookies(cookies, contextUrl) {
  const results = { total: cookies?.length || 0, ok: 0, fail: 0, errors: [] };
  const ctx = safeUrl(contextUrl);
  console.log("[cookies] writeCookies start: " + JSON.stringify({ total: results.total, contextUrl: String(ctx) }));

  // 详细记录每个Cookie的信息
  for (const c of cookies || []) {
    console.log(`[cookies] 准备写入: ${c.name}`, {
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      expirationDate: c.expirationDate,
      hostOnly: c.hostOnly,
      isHostPrefixed: c.name?.startsWith('__Host-')
    });
  }

  for (const c of cookies || []) {
    const name = c?.name; const dom = c?.domain; const hostOnly = !!c?.hostOnly;
    try {
      const removeReq = { url: cookieUrlFor(c, ctx), name: c.name };
      // 清理时尽量带上原字段，但忽略失败
      if (c.storeId) removeReq.storeId = c.storeId;
      if (c.partitionKey) removeReq.partitionKey = c.partitionKey;
      await chrome.cookies.remove(removeReq).catch(() => {});

      // 变体尝试：
      // v1: 基线（不带 storeId/partitionKey，hostOnly 不带 domain）
      // v2: 若失败且原本有 partitionKey，则追加 partitionKey
      // v3: 若失败且原本有 storeId，则追加 storeId
      // v4: 若失败且存在 domain/hostOnly 可能不匹配，切换 domain 设置重试
      const variants = [];
      variants.push(buildSetReq(c, ctx, { withPartitionKey: false, withStoreId: false, forceDomain: hostOnly ? false : !!dom }));
      if (c.partitionKey) variants.push(buildSetReq(c, ctx, { withPartitionKey: true, withStoreId: false, forceDomain: hostOnly ? false : !!dom }));
      if (c.storeId) variants.push(buildSetReq(c, ctx, { withPartitionKey: !!c.partitionKey, withStoreId: true, forceDomain: hostOnly ? false : !!dom }));
      // toggle domain presence
      variants.push(buildSetReq(c, ctx, { withPartitionKey: false, withStoreId: false, forceDomain: !hostOnly }));

      let success = false; let lastErr = "";
      for (let i = 0; i < variants.length; i++) {
        const req = variants[i];
        const res = await chrome.cookies.set(req);
        if (res) {
          success = true;
          // 记录成功写入的Cookie详情
          console.log(`[cookies] ✅ 写入成功: ${name}`, {
            domain: res.domain,
            path: res.path,
            secure: res.secure,
            httpOnly: res.httpOnly,
            sameSite: res.sameSite,
            expirationDate: res.expirationDate,
            hostOnly: res.hostOnly
          });
          break;
        }
        lastErr = chrome.runtime?.lastError?.message || "unknown";
        console.warn("[cookies] set failed variant " + JSON.stringify({ name, variant: i+1, err: lastErr }));
      }
      if (success) {
        results.ok++;
      } else {
        results.fail++; results.errors.push({ name, domain: dom, err: lastErr });
      }
    } catch (e) {
      results.fail++; results.errors.push({ name, domain: dom, err: String(e) });
      console.error("[cookies] exception while set " + JSON.stringify({ name, domain: dom, error: String(e) }));
    }
  }
  console.log("[cookies] writeCookies done: " + JSON.stringify(results));
  return results;
}

function buildSetReq(c, ctx, opts = {}) {
  // 检测是否是 __Host- 前缀的 Cookie
  const isHostPrefixed = c.name?.startsWith('__Host-');

  const req = {
    url: cookieUrlFor(c, ctx, isHostPrefixed),
    name: c.name,
    value: c.value || "",
    // __Host- Cookie 的 path 必须严格等于 /
    path: isHostPrefixed ? "/" : (c.path || "/"),
    // __Host- Cookie 必须设置 secure
    secure: isHostPrefixed ? true : !!c.secure,
    httpOnly: !!c.httpOnly,
  };

  // 记录 __Host- Cookie 的特殊处理
  if (isHostPrefixed) {
    console.log(`[cookies] __Host- Cookie 检测: ${c.name}, 强制 secure=true, path=/`);
  }

  // 传递 cookieName 以便记录日志
  const ttl = normalizeTTL(c.expirationDate, c.name);
  if (ttl !== undefined) req.expirationDate = ttl;
  const ss = normalizeSameSite(c.sameSite);
  if (ss) req.sameSite = ss;

  // __Host- Cookie 绝对不能设置 domain 属性
  // 其他 hostOnly cookie 也不要设置 domain
  const forceDomain = !!opts.forceDomain;
  if (!isHostPrefixed && !c.hostOnly && c.domain && forceDomain) {
    req.domain = sanitizeDomain(c.domain);
  }

  if (opts.withPartitionKey && c.partitionKey) req.partitionKey = c.partitionKey;
  if (opts.withStoreId && c.storeId) req.storeId = c.storeId;
  return req;
}

function cookieUrlFor(c, ctx, isHostPrefixed = false) {
  // 以当前页面上下文为准选择 scheme 与 host，确保与站点一致；
  // 对于 domain cookie，如当前 host 不后缀匹配 domain，则回退到 domain 去构造 url。
  const ctxHost = ctx.hostname;
  const ctxHostWithPort = ctx.host; // 可能包含端口
  const ctxProto = ctx.protocol.replace(":", "");
  const path = c.path || "/";
  const dom = (c.domain || "").replace(/^\./, "");
  const useCtxHost = !dom || ctxHost.endsWith(dom);
  const useHost = useCtxHost ? ctxHost : dom;
  // __Host- Cookie 必须使用 HTTPS
  // 其他 secure cookie 也需用 https；否则沿用上下文协议（默认为 https）
  const proto = (isHostPrefixed || c.secure) ? "https" : (ctxProto || "https");
  const hostForUrl = useCtxHost ? ctxHostWithPort : useHost;
  return `${proto}://${hostForUrl}${path}`;
}

function safeUrl(u) {
  try { return new URL(u || "https://example.com/"); }
  catch { return new URL("https://example.com/"); }
}

function sanitizeDomain(d) {
  return (d || "").replace(/^\./, "");
}

function normalizeSameSite(s) {
  // Chrome set API可接受: "no_restriction" | "lax" | "strict"；若源为"unspecified"则省略属性
  if (!s || s === "unspecified") return undefined;
  return s;
}

function normalizeTTL(exp, cookieName) {
  // 如果没有过期时间（Session Cookie），设置为 30 天后过期
  // 确保 Cookie 持久化，不会因为刷新或关闭标签页而消失
  if (exp === undefined || exp === null) {
    const thirtyDaysLater = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
    console.log(`[cookies] Session Cookie 转换为持久化: ${cookieName}, 过期时间: ${thirtyDaysLater}`);
    return thirtyDaysLater;
  }

  // 检查是否已经过期
  const now = Math.floor(Date.now() / 1000);
  if (exp < now) {
    // Cookie 已过期，延长到 30 天后
    const thirtyDaysLater = now + (30 * 24 * 60 * 60);
    console.log(`[cookies] Cookie 已过期，延长: ${cookieName}, 原过期时间: ${exp}, 新过期时间: ${thirtyDaysLater}`);
    return thirtyDaysLater;
  }

  // 检查是否即将过期（1小时内）
  if (exp - now < 3600) {
    // 即将过期，延长到 30 天后
    const thirtyDaysLater = now + (30 * 24 * 60 * 60);
    console.log(`[cookies] Cookie 即将过期，延长: ${cookieName}, 原过期时间: ${exp}, 新过期时间: ${thirtyDaysLater}`);
    return thirtyDaysLater;
  }

  // 过期时间正常，保持原样
  return exp;
}

export async function clearAllCookies(host, etld1, contextUrl) {
  const ctx = safeUrl(contextUrl);
  const all = await chrome.cookies.getAll({});
  const targets = all.filter((c) => {
    const d = (c.domain || "").replace(/^\./, "");
    // 修复：使用精确匹配或正确的域名后缀匹配
    return d === host || d === etld1 ||
           d.endsWith("." + host) || d.endsWith("." + etld1);
  });
  console.log("[cookies] clearAllCookies: " + JSON.stringify({
    total: all.length,
    targets: targets.length,
    host,
    etld1
  }));
  for (const c of targets) {
    try {
      const isHostPrefixed = c.name?.startsWith('__Host-');
      const reqCtx = { url: cookieUrlFor(c, ctx, isHostPrefixed), name: c.name };
      if (c.storeId) reqCtx.storeId = c.storeId;
      if (c.partitionKey) reqCtx.partitionKey = c.partitionKey;
      await chrome.cookies.remove(reqCtx).catch(() => {});
      // __Host- Cookie 只需要用 HTTPS 尝试删除
      const protocols = isHostPrefixed ? ["https"] : ["http", "https"];
      for (const proto of protocols) {
        const dom = (c.domain || "").replace(/^\./, "");
        const path = c.path || "/";
        const req = { url: `${proto}://${dom}${path}`, name: c.name };
        if (c.storeId) req.storeId = c.storeId;
        if (c.partitionKey) req.partitionKey = c.partitionKey;
        await chrome.cookies.remove(req).catch(() => {});
      }
    } catch (_) {}
  }
}
