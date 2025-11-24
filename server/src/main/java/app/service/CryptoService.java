// 使用方法：encrypt/decrypt 预留，MVP 直接透传；生产请接入 SM4-GCM。
// 说明：后续接入 KMS/KeyId 轮转时保持方法签名不变。

package app.service;

import org.springframework.stereotype.Service;

@Service
public class CryptoService {
    public String encrypt(String json) {
        return json;
    }

    public String decrypt(String payload) {
        return payload;
    }
}

