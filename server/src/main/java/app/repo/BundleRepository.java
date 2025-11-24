// 使用方法：内存 Map 充当最小存储；后续可替换为 DB 实现。
// 说明：提供按 id 的 CRUD 与过期简单判断。

package app.repo;

import app.model.CookieBundle;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class BundleRepository {
    private final Map<String, CookieBundle> store = new ConcurrentHashMap<>();

    public void save(CookieBundle b) {
        store.put(b.id, b);
    }

    public Optional<CookieBundle> findValid(String id) {
        CookieBundle b = store.get(id);
        if (b == null) return Optional.empty();
        if (b.expireAt > 0 && b.expireAt < System.currentTimeMillis()) return Optional.empty();
        return Optional.of(b);
    }
}

