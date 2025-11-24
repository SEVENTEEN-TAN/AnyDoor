// 使用方法：传入 window.location.hostname，返回近似 eTLD+1。
// 说明：MVP 简化：取最后两段；复杂公共后缀列表后续引入。

export function getETLD1(host) {
  const h = host || "";
  // IPv4: 1.2.3.4 直接返回
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return h;
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join(".");
}
