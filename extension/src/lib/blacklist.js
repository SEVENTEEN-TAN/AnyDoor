// 使用方法：上传前用 filterCookies 过滤黑名单，避免敏感 Cookie 上行。
// 说明：MVP 使用 JS RegExp，服务端提供的 pattern 请控制长度与转义。

export function filterCookies(cookies, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return cookies;
  const regs = patterns.map((p) => safeReg(p)).filter(Boolean);
  return cookies.filter((c) => !regs.some((re) => re.test(`${c.domain}|${c.name}`)));
}

function safeReg(p) {
  try {
    return new RegExp(p);
  } catch (_) {
    return null;
  }
}

