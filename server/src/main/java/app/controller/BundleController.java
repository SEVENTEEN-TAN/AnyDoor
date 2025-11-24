// 使用方法：
// - POST /api/bundle/upload { host, etld1, cookies:[...] } -> { bundleId, expireAt }
// - POST /api/bundle/writeback { bundleId } -> { host, etld1, cookies:[...] }
// 说明：MVP 使用内存存储；鉴权使用 Sa-Token 登录态。

package app.controller;

import app.model.CookieBundle;
import app.service.BundleService;
import cn.dev33.satoken.annotation.SaCheckLogin;
import cn.dev33.satoken.stp.StpUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/bundle")
public class BundleController {
    private final BundleService service;
    private final ObjectMapper om = new ObjectMapper();

    public BundleController(BundleService service) {
        this.service = service;
    }

    public record UploadReq(
            String name,
            String groupId,
            String shareMode,
            String description,
            String tags,
            Integer expireDays,
            String host,
            String etld1,
            Object cookies,
            Object storage
    ) {
    }

    @PostMapping("/upload")
    @SaCheckLogin
    public ResponseEntity<?> upload(@RequestBody UploadReq req) throws Exception {
        String ownerId = String.valueOf(StpUtil.getLoginId());

        // 验证必填参数
        if (req.name() == null || req.name().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Bundle名称不能为空"));
        }

        // 默认有效期7天
        int expireDays = req.expireDays() != null ? req.expireDays() : 7;
        if (expireDays <= 0 || expireDays > 365) {
            return ResponseEntity.badRequest().body(Map.of("error", "有效期必须在1-365天之间"));
        }

        // 默认分享模式为 PRIVATE
        String shareMode = req.shareMode() != null ? req.shareMode() : "PRIVATE";
        if (!"PRIVATE".equals(shareMode) && !"GROUP_ONLY".equals(shareMode) && !"PUBLIC".equals(shareMode)) {
            return ResponseEntity.badRequest().body(Map.of("error", "分享模式只能是 PRIVATE, GROUP_ONLY 或 PUBLIC"));
        }

        // 确定组ID：如果分享模式为GROUP_ONLY但未指定组，则使用用户的第一个组（通常是默认组）
        String groupId = req.groupId();
        if ("GROUP_ONLY".equals(shareMode) && (groupId == null || groupId.isBlank())) {
            // 查询用户的组，使用第一个组（通常是默认组）
            var userGroups = service.getUserGroups(ownerId);
            if (userGroups.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "您还没有加入任何组，无法使用组内分享模式"));
            }
            groupId = userGroups.get(0).id;
        }

        String json = om.writeValueAsString(Map.of(
                "host", req.host(),
                "etld1", req.etld1(),
                "cookies", req.cookies(),
                "storage", req.storage()
        ));

        CookieBundle b = service.save(
                ownerId,
                groupId,
                req.name(),
                shareMode,
                req.description(),
                req.tags(),
                req.host(),
                req.etld1(),
                expireDays,
                json
        );

        return ResponseEntity.ok(Map.of(
                "bundleId", b.id,
                "name", b.name,
                "shareMode", b.shareMode,
                "expireAt", b.expireAt,
                "count", req.cookies() != null ?
                        (req.cookies() instanceof java.util.List ? ((java.util.List<?>) req.cookies()).size() : 0) : 0
        ));
    }

    public record WriteReq(String bundleId) {
    }

    @PostMapping("/writeback")
    @SaCheckLogin
    public ResponseEntity<?> writeback(@RequestBody WriteReq req) throws Exception {
        String userId = String.valueOf(StpUtil.getLoginId());
        var opt = service.get(req.bundleId());
        if (opt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "not found"));

        var b = opt.get();

        // 权限检查：根据分享模式和引用关系判断访问权限
        boolean hasAccess = false;

        // 1. 如果是所有者，始终有权限
        if (userId.equals(b.ownerId)) {
            hasAccess = true;
        }
        // 2. 如果用户已导入该Bundle（有引用记录），则有权限（支持PRIVATE分享）
        else if (service.hasReference(userId, b.id)) {
            hasAccess = true;
        }
        else if ("PUBLIC".equals(b.shareMode)) {
            hasAccess = true;
        }
        // 4. 如果是GROUP_ONLY，需要检查是否在同一组
        else if ("GROUP_ONLY".equals(b.shareMode) && b.groupId != null) {
            hasAccess = service.isUserInGroup(userId, b.groupId);
        }

        if (!hasAccess) {
            return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
        }

        Map<?, ?> data = om.readValue(b.payload, Map.class);
        return ResponseEntity.ok(data);
    }

    /**
     * 获取用户可见的 Bundle 列表
     */
    @GetMapping("/list")
    @SaCheckLogin
    public ResponseEntity<?> list() {
        String userId = String.valueOf(StpUtil.getLoginId());
        var bundles = service.listUserBundles(userId);
        return ResponseEntity.ok(Map.of("bundles", bundles));
    }

    /**
     * 导入 Bundle
     */
    public record ImportReq(String bundleId) {
    }

    @PostMapping("/import")
    @SaCheckLogin
    public ResponseEntity<?> importBundle(@RequestBody ImportReq req) {
        String userId = String.valueOf(StpUtil.getLoginId());

        if (req.bundleId() == null || req.bundleId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "bundleId 不能为空"));
        }

        boolean success = service.importBundle(userId, req.bundleId());

        if (!success) {
            return ResponseEntity.status(404).body(Map.of("error", "Bundle 不存在或无权访问"));
        }

        return ResponseEntity.ok(Map.of("ok", true, "message", "导入成功"));
    }

    /**
     * 修改 Bundle 分享模式
     */
    public record UpdateShareModeReq(String bundleId, String shareMode) {
    }

    @PostMapping("/update-share-mode")
    @SaCheckLogin
    public ResponseEntity<?> updateShareMode(@RequestBody UpdateShareModeReq req) {
        String userId = String.valueOf(StpUtil.getLoginId());

        if (req.bundleId() == null || req.bundleId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "bundleId 不能为空"));
        }

        if (req.shareMode() == null || req.shareMode().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "shareMode 不能为空"));
        }

        if (!"GROUP_ONLY".equals(req.shareMode()) && !"PRIVATE".equals(req.shareMode()) && !"PUBLIC".equals(req.shareMode())) {
            return ResponseEntity.badRequest().body(Map.of("error", "分享模式只能是 GROUP_ONLY, PRIVATE 或 PUBLIC"));
        }

        boolean success = service.updateShareMode(userId, req.bundleId(), req.shareMode());

        if (!success) {
            return ResponseEntity.status(404).body(Map.of("error", "Bundle 不存在或无权修改"));
        }

        return ResponseEntity.ok(Map.of("ok", true, "shareMode", req.shareMode(), "message", "分享模式已更新"));
    }

    /**
     * 删除Bundle
     */
    public record DeleteBundleReq(String bundleId) {
    }

    @PostMapping("/delete")
    public ResponseEntity<?> deleteBundle(@RequestBody DeleteBundleReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || req.bundleId() == null || req.bundleId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Bundle ID不能为空"));
        }

        try {
            String userId = String.valueOf(StpUtil.getLoginId());
            boolean success = service.deleteBundle(req.bundleId(), userId);

            if (success) {
                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "message", "Bundle已删除"
                ));
            } else {
                return ResponseEntity.status(500).body(Map.of("error", "删除失败"));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "删除失败"));
        }
    }

    /**
     * 移除已导入的Bundle引用
     */
    public record RemoveReferenceReq(String bundleId) {
    }

    @PostMapping("/remove-reference")
    public ResponseEntity<?> removeReference(@RequestBody RemoveReferenceReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || req.bundleId() == null || req.bundleId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Bundle ID不能为空"));
        }

        try {
            String userId = String.valueOf(StpUtil.getLoginId());
            boolean success = service.removeReference(req.bundleId(), userId);

            if (success) {
                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "message", "已移除导入的Bundle"
                ));
            } else {
                return ResponseEntity.status(500).body(Map.of("error", "移除失败"));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "移除失败"));
        }
    }

    /**
     * 获取Bundle详情
     */
    @GetMapping("/detail/{bundleId}")
    @SaCheckLogin
    public ResponseEntity<?> getDetail(@PathVariable String bundleId) {
        String userId = String.valueOf(StpUtil.getLoginId());

        var opt = service.get(bundleId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Bundle不存在"));
        }

        var bundle = opt.get();

        // 权限检查：根据分享模式和引用关系判断访问权限
        boolean hasAccess = false;

        // 1. 如果是所有者，始终有权限
        if (userId.equals(bundle.ownerId)) {
            hasAccess = true;
        }
        // 2. 如果用户已导入该Bundle（有引用记录），则有权限（支持PRIVATE分享）
        else if (service.hasReference(userId, bundle.id)) {
            hasAccess = true;
        }
        else if ("GLOBAL".equals(bundle.shareMode)) {
            hasAccess = true;
        }
        // 4. 如果是GROUP_ONLY，需要检查是否在同一组
        else if ("GROUP_ONLY".equals(bundle.shareMode) && bundle.groupId != null) {
            hasAccess = service.isUserInGroup(userId, bundle.groupId);
        }

        if (!hasAccess) {
            return ResponseEntity.status(403).body(Map.of("error", "无权查看该Bundle"));
        }

        return ResponseEntity.ok(Map.ofEntries(
                Map.entry("id", bundle.id),
                Map.entry("name", bundle.name),
                Map.entry("description", bundle.description != null ? bundle.description : ""),
                Map.entry("tags", bundle.tags != null ? bundle.tags : ""),
                Map.entry("host", bundle.host),
                Map.entry("etld1", bundle.etld1),
                Map.entry("shareMode", bundle.shareMode),
                Map.entry("groupId", bundle.groupId != null ? bundle.groupId : ""),
                Map.entry("ownerId", bundle.ownerId),
                Map.entry("createdAt", bundle.createdAt),
                Map.entry("expireAt", bundle.expireAt)
        ));
    }

    /**
     * 更新Bundle信息
     */
    public record UpdateBundleReq(
            String bundleId,
            String name,
            String description,
            String tags,
            String shareMode,
            String groupId,
            Integer expireDays
    ) {
    }

    @PostMapping("/update")
    @SaCheckLogin
    public ResponseEntity<?> updateBundle(@RequestBody UpdateBundleReq req) {
        String userId = String.valueOf(StpUtil.getLoginId());

        if (req.bundleId() == null || req.bundleId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Bundle ID不能为空"));
        }

        try {
            boolean success = service.updateBundle(
                    userId,
                    req.bundleId(),
                    req.name(),
                    req.description(),
                    req.tags(),
                    req.shareMode(),
                    req.groupId(),
                    req.expireDays()
            );

            if (success) {
                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "message", "Bundle信息已更新"
                ));
            } else {
                return ResponseEntity.status(500).body(Map.of("error", "更新失败"));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "更新失败：" + e.getMessage()));
        }
    }

    // ============================================
    // 分享管理接口（v3.1 新增）
    // ============================================

    /**
     * 创建分享记录
     */
    @PostMapping("/{bundleId}/share")
    @SaCheckLogin
    public ResponseEntity<?> createShare(@PathVariable String bundleId) {
        try {
            String ownerId = String.valueOf(StpUtil.getLoginId());
            app.model.BundleShare share = service.createShare(bundleId, ownerId);
            
            // 构建分享链接
            String shareLink = "https://example.com/share?token=" + share.shareToken;
            
            return ResponseEntity.ok(Map.of(
                "share", Map.of(
                    "id", share.id,
                    "bundleId", share.bundleId,
                    "shareToken", share.shareToken,
                    "shareLink", shareLink,
                    "status", share.status,
                    "usedCount", share.usedCount,
                    "createdAt", share.createdAt
                )
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "创建分享失败：" + e.getMessage()));
        }
    }

    /**
     * 查询分享记录列表
     */
    @GetMapping("/{bundleId}/shares")
    @SaCheckLogin
    public ResponseEntity<?> listShares(@PathVariable String bundleId) {
        try {
            String ownerId = String.valueOf(StpUtil.getLoginId());
            java.util.List<Map<String, Object>> shares = service.listSharesWithUserCount(bundleId, ownerId);
            
            return ResponseEntity.ok(Map.of("shares", shares));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "查询分享列表失败：" + e.getMessage()));
        }
    }

    /**
     * 撤销分享记录（让分享失效，但保留记录）
     */
    @DeleteMapping("/share/{shareId}")
    @SaCheckLogin
    public ResponseEntity<?> revokeShare(@PathVariable String shareId) {
        try {
            String ownerId = String.valueOf(StpUtil.getLoginId());
            service.revokeShare(shareId, ownerId);
            
            return ResponseEntity.ok(Map.of(
                "ok", true,
                "message", "分享已撤销"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "撤销分享失败：" + e.getMessage()));
        }
    }

    /**
     * 删除分享记录（彻底删除）
     */
    @DeleteMapping("/share/{shareId}/delete")
    @SaCheckLogin
    public ResponseEntity<?> deleteShare(@PathVariable String shareId) {
        try {
            String ownerId = String.valueOf(StpUtil.getLoginId());
            service.deleteShare(shareId, ownerId);
            
            return ResponseEntity.ok(Map.of(
                "ok", true,
                "message", "分享记录已删除"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "删除分享记录失败：" + e.getMessage()));
        }
    }

    /**
     * 通过 share_token 导入站点
     */
    public record ImportByTokenReq(String shareToken) {}

    @PostMapping("/import-by-token")
    @SaCheckLogin
    public ResponseEntity<?> importByToken(@RequestBody ImportByTokenReq req) {
        try {
            String userId = String.valueOf(StpUtil.getLoginId());
            boolean success = service.importByToken(userId, req.shareToken());
            
            if (success) {
                return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "message", "导入成功"
                ));
            } else {
                return ResponseEntity.status(403).body(Map.of("error", "导入失败"));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "导入异常：" + e.getMessage()));
        }
    }

    /**
     * 关闭已导入的站点（将引用设置为不可见）
     */
    @DeleteMapping("/{bundleId}/reference")
    @SaCheckLogin
    public ResponseEntity<?> closeReference(@PathVariable String bundleId) {
        try {
            String userId = String.valueOf(StpUtil.getLoginId());
            
            // 查询引用记录并设置为不可见
            var ref = service.removeReference(bundleId, userId);
            
            return ResponseEntity.ok(Map.of(
                "ok", true,
                "message", "站点已关闭"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "关闭失败：" + e.getMessage()));
        }
    }

    /**
     * 获取分享使用者列表
     */
    @GetMapping("/share/{shareId}/users")
    @SaCheckLogin
    public ResponseEntity<?> getShareUsers(@PathVariable String shareId) {
        try {
            String ownerId = String.valueOf(StpUtil.getLoginId());
            java.util.List<Map<String, Object>> users = service.getShareUsers(shareId, ownerId);
            
            return ResponseEntity.ok(Map.of("users", users));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "查询使用者列表失败：" + e.getMessage()));
        }
    }

    /**
     * 移除特定用户的分享访问权限
     */
    @DeleteMapping("/share/{shareId}/user/{userId}")
    @SaCheckLogin
    public ResponseEntity<?> removeShareUser(@PathVariable String shareId, @PathVariable String userId) {
        try {
            String ownerId = String.valueOf(StpUtil.getLoginId());
            service.removeShareUser(shareId, userId, ownerId);
            
            return ResponseEntity.ok(Map.of(
                "ok", true,
                "message", "用户访问权限已移除"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "移除失败：" + e.getMessage()));
        }
    }
}
