// 使用方法：GET /api/blacklist 返回黑名单版本与模式。
// 说明：MVP 以内存常量返回，生产建议接入配置中心或数据库。

package app.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/blacklist")
public class BlacklistController {
    @GetMapping
    public ResponseEntity<?> getList() {
        return ResponseEntity.ok(Map.of(
                "version", 1,
                "patterns", List.of(
                        Map.of("pattern", "(^|\\.)example\\.com\\|session", "enabled", true),
                        Map.of("pattern", "(^|\\.)sso\\.corp\\.com\\|token", "enabled", true)
                )
        ));
    }
}

