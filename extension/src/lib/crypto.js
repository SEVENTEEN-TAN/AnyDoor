// 使用方法：MVP 透传由后端完成加密/解密；预留接口供后续前端加密演进。
// 说明：为保持最小实现，当前返回输入值。

export function encryptBundle(plain) {
  return plain; // MVP 透传
}

export function decryptBundle(payload) {
  return payload; // MVP 透传
}

