// v3.0: 真实的用户认证系统
// 功能：用户注册、登录、登出、获取用户信息
// 密码使用 BCrypt 加密存储

package app.controller;

import app.model.User;
import app.model.dto.CleanupResult;
import app.model.dto.OrphanedDataStats;
import app.model.dto.UpdateSubAccountRequest;
import app.service.BundleService;
import app.service.GroupService;
import app.service.UserService;
import app.service.CaptchaService;
import cn.dev33.satoken.stp.StpUtil;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final GroupService groupService;
    private final BundleService bundleService;
    private final CaptchaService captchaService;
    private final app.service.CacheCleanupService cacheCleanupService;
    private final app.service.LinuxDoAuthService linuxDoAuthService;

    public AuthController(UserService userService, GroupService groupService, BundleService bundleService, CaptchaService captchaService, app.service.CacheCleanupService cacheCleanupService, app.service.LinuxDoAuthService linuxDoAuthService) {
        this.userService = userService;
        this.groupService = groupService;
        this.bundleService = bundleService;
        this.captchaService = captchaService;
        this.cacheCleanupService = cacheCleanupService;
        this.linuxDoAuthService = linuxDoAuthService;
    }

    public record LoginReq(String username, String password) {
    }

    public record RegisterReq(String username, String password, String email) {
    }

    public record RegisterWithGroupReq(String username, String password, String email, String groupName) {
    }

    public record ChangePasswordReq(String currentPassword, String newPassword) {
    }

    public record CreateSubAccountReq(String username, String password, String email, String groupId) {
    }

    /**
     * 用户注册（普通用户）
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterReq req) {
        if (req == null || isBlank(req.username()) || isBlank(req.password())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名和密码不能为空"));
        }

        try {
            User user = userService.register(req.username(), req.password(), req.email());

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("userId", user.id);
            respMap.put("username", user.username);
            respMap.put("role", user.role);
            return ResponseEntity.ok(respMap);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 用户注册（组主账号，自动创建组）
     */
    @PostMapping("/register-with-group")
    public ResponseEntity<?> registerWithGroup(@RequestBody RegisterWithGroupReq req) {
        if (req == null || isBlank(req.username()) || isBlank(req.password()) || isBlank(req.groupName())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名、密码和组名不能为空"));
        }

        try {
            User user = userService.registerWithGroup(
                    req.username(),
                    req.password(),
                    req.email(),
                    req.groupName()
            );

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("userId", user.id);
            respMap.put("username", user.username);
            respMap.put("role", user.role);
            return ResponseEntity.ok(respMap);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 用户登录
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginReq req, HttpServletResponse resp) {
        if (req == null || isBlank(req.username()) || isBlank(req.password())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名和密码不能为空"));
        }

        try {
            // 真实认证
            Optional<User> userOpt = userService.authenticate(req.username(), req.password());

            if (userOpt.isEmpty()) {
                return ResponseEntity.status(401).body(Map.of("error", "用户名或密码错误"));
            }

            User user = userOpt.get();

            // 登录成功，创建会话
            StpUtil.login(user.id);
            String token = StpUtil.getTokenValue();

            // 设置 Cookie
            String cookie = String.format("%s=%s; Path=/; HttpOnly; Max-Age=%d; SameSite=Lax",
                    StpUtil.getTokenName(), token, (int) Duration.ofDays(7).getSeconds());
            resp.addHeader("Set-Cookie", cookie);

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("token", token);
            respMap.put("userId", user.id);
            respMap.put("username", user.username);
            respMap.put("role", user.role);
            return ResponseEntity.ok(respMap);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "登录失败"));
        }
    }

    /**
     * 获取当前用户信息
     */
    @GetMapping("/me")
    public ResponseEntity<?> me() {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "not_login"));
        }

        String userId = String.valueOf(StpUtil.getLoginId());
        Optional<User> userOpt = userService.getUserById(userId);

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "用户不存在"));
        }

        User user = userOpt.get();
        Map<String, Object> respMap = new HashMap<>();
        respMap.put("userId", user.id);
        respMap.put("username", user.username);
        respMap.put("email", user.email);
        respMap.put("displayName", user.displayName);
        respMap.put("role", user.role);
        respMap.put("status", user.status);

        return ResponseEntity.ok(respMap);
    }

    /**
     * 用户登出
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        if (StpUtil.isLogin()) {
            StpUtil.logout();
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /**
     * 修改密码
     */
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.currentPassword()) || isBlank(req.newPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "当前密码和新密码不能为空"));
        }

        if (req.newPassword().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "新密码至少需要6位"));
        }

        try {
            String userId = String.valueOf(StpUtil.getLoginId());
            userService.updatePassword(userId, req.currentPassword(), req.newPassword());

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "message", "密码修改成功"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "修改密码失败"));
        }
    }

    /**
     * 创建子账号
     * 子账号会自动关联到当前登录的主账号
     */
    @PostMapping("/create-subaccount")
    public ResponseEntity<?> createSubAccount(@RequestBody CreateSubAccountReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.username()) || isBlank(req.password())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名和密码不能为空"));
        }

        if (req.password().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "密码至少需要6位"));
        }

        try {
            // 获取当前用户
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：只有GROUP_OWNER和GLOBAL_ADMIN可以创建子账号
            if (!"GROUP_OWNER".equals(currentUser.role) && !"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足，只有主账号可以创建子账号"));
            }

            // 创建子账号并关联到当前用户
            User subAccount = userService.createSubAccount(currentUserId, req.username(), req.password(), req.email(), req.groupId());

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("ok", true);
            respMap.put("userId", subAccount.id);
            respMap.put("username", subAccount.username);
            respMap.put("message", "子账号创建成功");

            return ResponseEntity.ok(respMap);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "创建子账号失败"));
        }
    }

    /**
     * 查询子账号列表（含所属组信息）
     */
    @GetMapping("/subaccounts")
    public ResponseEntity<?> listSubAccounts() {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限
            if (!"GROUP_OWNER".equals(currentUser.role) && !"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 查询子账号列表（含所属组信息）
            var subAccounts = userService.getSubAccountsWithGroups(currentUserId);

            // 构建响应
            var subAccountList = subAccounts.stream().map(dto -> {
                Map<String, Object> userMap = new HashMap<>();
                userMap.put("userId", dto.userId);
                userMap.put("username", dto.username);
                userMap.put("email", dto.email);
                userMap.put("status", dto.status);
                userMap.put("createdAt", dto.createdAt);
                userMap.put("groupNames", dto.groupNames);  // 新增：所属组列表
                return userMap;
            }).toList();

            return ResponseEntity.ok(Map.of(
                    "subAccounts", subAccountList
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "查询子账号失败"));
        }
    }

    /**
     * 查询所有主账号（仅管理员）
     */
    @GetMapping("/admin/users")
    public ResponseEntity<?> listMainAccounts() {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以查看
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足，仅系统管理员可以查看"));
            }

            // 查询所有主账号
            var users = userService.listMainAccounts();

            // 构建响应
            var userList = users.stream().map(u -> {
                Map<String, Object> userMap = new HashMap<>();
                userMap.put("userId", u.id);
                userMap.put("username", u.username);
                userMap.put("email", u.email);
                userMap.put("displayName", u.displayName);
                userMap.put("role", u.role);
                userMap.put("status", u.status);
                userMap.put("createdAt", u.createdAt);
                return userMap;
            }).toList();

            return ResponseEntity.ok(Map.of(
                    "users", userList,
                    "total", userList.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "查询失败"));
        }
    }

    /**
     * 获取指定用户的详细信息（仅管理员）
     */
    @GetMapping("/admin/user/{userId}")
    public ResponseEntity<?> getUserDetails(@PathVariable String userId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以查看
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 查询目标用户
            Optional<User> targetUserOpt = userService.getUserById(userId);
            if (targetUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "用户不存在"));
            }

            User targetUser = targetUserOpt.get();

            // 获取统计信息
            var stats = userService.getUserStats(userId);

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("userId", targetUser.id);
            respMap.put("username", targetUser.username);
            respMap.put("email", targetUser.email);
            respMap.put("displayName", targetUser.displayName);
            respMap.put("role", targetUser.role);
            respMap.put("status", targetUser.status);
            respMap.put("createdAt", targetUser.createdAt);
            respMap.put("updatedAt", targetUser.updatedAt);
            respMap.put("stats", stats);

            return ResponseEntity.ok(respMap);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "查询失败"));
        }
    }

    /**
     * 查询指定用户的子账号（仅管理员）
     */
    @GetMapping("/admin/user/{userId}/subaccounts")
    public ResponseEntity<?> getUserSubAccounts(@PathVariable String userId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以查看
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 查询目标用户的子账号
            var subAccounts = userService.getSubAccountsByParentId(userId);

            // 构建响应
            var subAccountList = subAccounts.stream().map(u -> {
                Map<String, Object> userMap = new HashMap<>();
                userMap.put("userId", u.id);
                userMap.put("username", u.username);
                userMap.put("email", u.email);
                userMap.put("displayName", u.displayName);
                userMap.put("status", u.status);
                userMap.put("createdAt", u.createdAt);
                return userMap;
            }).toList();

            return ResponseEntity.ok(Map.of(
                    "subaccounts", subAccountList
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "查询失败"));
        }
    }

    /**
     * 查询指定用户的组（仅管理员）
     */
    @GetMapping("/admin/user/{userId}/groups")
    public ResponseEntity<?> getUserGroups(@PathVariable String userId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以查看
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 查询目标用户作为owner的组
            var groups = groupService.getGroupsByOwnerId(userId);

            var groupList = groups.stream().map(g -> {
                Map<String, Object> groupMap = new HashMap<>();
                groupMap.put("id", g.id);
                groupMap.put("groupName", g.groupName);
                groupMap.put("description", g.description);
                groupMap.put("ownerId", g.ownerId);
                groupMap.put("createdAt", g.createdAt);

                // 获取组成员数量
                int memberCount = groupService.getGroupMemberCount(g.id);
                groupMap.put("memberCount", memberCount);

                // 获取组内Bundle数量（包括主账号和所有子账号的Bundle）
                int bundleCount = bundleService.countBundlesByGroupId(g.id);
                groupMap.put("bundleCount", bundleCount);

                return groupMap;
            }).toList();

            return ResponseEntity.ok(Map.of(
                    "groups", groupList,
                    "total", groupList.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "查询失败"));
        }
    }

    /**
     * 管理员创建主账号
     */
    public record CreateMainAccountReq(String username, String password, String email) {
    }

    @PostMapping("/admin/create-main-account")
    public ResponseEntity<?> createMainAccount(@RequestBody CreateMainAccountReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.username()) || isBlank(req.password())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名和密码不能为空"));
        }

        if (req.password().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "密码至少需要6位"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以创建
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足，仅系统管理员可以创建主账号"));
            }

            // 创建主账号（带默认组）
            User newUser = userService.createMainAccountByAdmin(req.username(), req.password(), req.email());

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("ok", true);
            respMap.put("userId", newUser.id);
            respMap.put("username", newUser.username);
            respMap.put("role", newUser.role);
            respMap.put("message", "主账号创建成功");

            return ResponseEntity.ok(respMap);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "创建主账号失败"));
        }
    }

    /**
     * 获取验证码
     */
    @GetMapping("/captcha")
    public ResponseEntity<?> getCaptcha() {
        return ResponseEntity.ok(captchaService.generate());
    }

    /**
     * 用户自助注册主账号（公开）
     */
    public record RegisterMainReq(String username, String password, String email, String captchaUuid, String captchaCode) {
    }

    @PostMapping("/register-main")
    public ResponseEntity<?> registerMain(@RequestBody RegisterMainReq req) {
        if (req == null || isBlank(req.username()) || isBlank(req.password())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名和密码不能为空"));
        }

        // 验证验证码
        if (isBlank(req.captchaUuid()) || isBlank(req.captchaCode())) {
            return ResponseEntity.badRequest().body(Map.of("error", "请输入验证码"));
        }

        if (!captchaService.validate(req.captchaUuid(), req.captchaCode())) {
             return ResponseEntity.badRequest().body(Map.of("error", "验证码错误或已失效"));
        }

        if (req.password().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "密码至少需要6位"));
        }

        try {
            // 直接调用创建主账号逻辑（与管理员创建逻辑一致，但通过公开接口暴露）
            User newUser = userService.createMainAccountByAdmin(req.username(), req.password(), req.email());

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("ok", true);
            respMap.put("userId", newUser.id);
            respMap.put("username", newUser.username);
            respMap.put("role", newUser.role);
            respMap.put("message", "注册成功");

            return ResponseEntity.ok(respMap);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "注册失败"));
        }
    }

    /**
     * 子账号管理 - 切换状态（停用/启用）
     */
    public record ToggleSubAccountStatusReq(String subAccountId) {
    }

    @PostMapping("/subaccount/toggle-status")
    public ResponseEntity<?> toggleSubAccountStatus(@RequestBody ToggleSubAccountStatusReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.subAccountId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "子账号ID不能为空"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：只有GROUP_OWNER和GLOBAL_ADMIN可以管理子账号
            if (!"GROUP_OWNER".equals(currentUser.role) && !"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 切换子账号状态
            User updatedUser = userService.toggleUserStatus(req.subAccountId());

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "userId", updatedUser.id,
                    "status", updatedUser.status,
                    "message", "ACTIVE".equals(updatedUser.status) ? "账号已启用" : "账号已停用"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "操作失败"));
        }
    }

    /**
     * 子账号管理 - 编辑（修改密码和所属组）
     */
    @PutMapping("/subaccount/{subAccountId}")
    public ResponseEntity<?> updateSubAccount(
            @PathVariable String subAccountId,
            @RequestBody UpdateSubAccountRequest request
    ) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (subAccountId == null || subAccountId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "子账号ID不能为空"));
        }

        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "请求参数不能为空"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());

            // 更新子账号信息（密码和所属组）
            userService.updateSubAccount(
                    subAccountId,
                    currentUserId,
                    request.password(),
                    request.groupId()
            );

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "message", "子账号信息更新成功"
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "更新子账号失败"));
        }
    }

    /**
     * 子账号管理 - 删除（支持级联删除）
     */
    @DeleteMapping("/subaccount/{subAccountId}")
    public ResponseEntity<?> deleteSubAccountWithCascade(
            @PathVariable String subAccountId,
            @RequestParam(defaultValue = "true") boolean cascade
    ) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (subAccountId == null || subAccountId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "子账号ID不能为空"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());

            if (cascade) {
                // 级联删除
                int deletedBundlesCount = userService.deleteSubAccountWithCascade(subAccountId, currentUserId);

                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "message", "子账号已删除",
                        "deletedBundlesCount", deletedBundlesCount
                ));
            } else {
                // 普通删除（保留站点）
                userService.deleteUser(subAccountId);

                return ResponseEntity.ok(Map.of(
                        "ok", true,
                        "message", "子账号已删除"
                ));
            }
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "删除子账号失败"));
        }
    }

    /**
     * 子账号管理 - 删除（旧接口，保持向后兼容）
     */
    public record DeleteSubAccountReq(String subAccountId) {
    }

    @PostMapping("/subaccount/delete")
    public ResponseEntity<?> deleteSubAccount(@RequestBody DeleteSubAccountReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.subAccountId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "子账号ID不能为空"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());

            // 默认使用级联删除
            int deletedBundlesCount = userService.deleteSubAccountWithCascade(req.subAccountId(), currentUserId);

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "message", "子账号已删除",
                    "deletedBundlesCount", deletedBundlesCount
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "删除失败"));
        }
    }

    /**
     * 管理员 - 切换主账号状态（连带子账号）
     */
    public record ToggleMainAccountStatusReq(String userId) {
    }

    @PostMapping("/admin/user/toggle-status")
    public ResponseEntity<?> toggleMainAccountStatus(@RequestBody ToggleMainAccountStatusReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.userId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户ID不能为空"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以操作
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 切换主账号及子账号状态
            int affectedCount = userService.toggleUserStatusWithChildren(req.userId());

            // 获取更新后的用户状态
            Optional<User> updatedUserOpt = userService.getUserById(req.userId());
            String newStatus = updatedUserOpt.map(u -> u.status).orElse("UNKNOWN");

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "affectedCount", affectedCount,
                    "status", newStatus,
                    "message", "ACTIVE".equals(newStatus) ?
                            String.format("已启用%d个账号（含子账号）", affectedCount) :
                            String.format("已停用%d个账号（含子账号）", affectedCount)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "操作失败"));
        }
    }

    /**
     * 管理员 - 删除主账号（连带子账号）
     */
    public record DeleteMainAccountReq(String userId) {
    }

    @PostMapping("/admin/user/delete")
    public ResponseEntity<?> deleteMainAccount(@RequestBody DeleteMainAccountReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.userId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户ID不能为空"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以操作
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 防止删除自己
            if (currentUserId.equals(req.userId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "不能删除自己"));
            }

            // 删除主账号及子账号
            int deletedCount = userService.deleteUserWithChildren(req.userId());

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "deletedCount", deletedCount,
                    "message", String.format("已删除%d个账号（含子账号）", deletedCount)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "删除失败"));
        }
    }

    /**
     * 管理员 - 切换指定用户的子账号状态
     */
    public record ToggleUserSubAccountStatusReq(String subAccountId) {
    }

    @PostMapping("/admin/user/{userId}/subaccount/toggle-status")
    public ResponseEntity<?> toggleUserSubAccountStatus(
            @PathVariable String userId,
            @RequestBody ToggleUserSubAccountStatusReq req
    ) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.subAccountId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "子账号ID不能为空"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以操作
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 切换子账号状态
            User updatedUser = userService.toggleUserStatus(req.subAccountId());

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "userId", updatedUser.id,
                    "status", updatedUser.status,
                    "message", "ACTIVE".equals(updatedUser.status) ? "账号已启用" : "账号已停用"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "操作失败"));
        }
    }

    /**
     * 管理员 - 删除指定用户的子账号
     */
    public record DeleteUserSubAccountReq(String subAccountId) {
    }

    @PostMapping("/admin/user/{userId}/subaccount/delete")
    public ResponseEntity<?> deleteUserSubAccount(
            @PathVariable String userId,
            @RequestBody DeleteUserSubAccountReq req
    ) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.subAccountId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "子账号ID不能为空"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以操作
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 删除子账号
            userService.deleteUser(req.subAccountId());

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "message", "子账号已删除"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "删除失败"));
        }
    }

    /**
     * 管理员查询指定用户的所有Bundle（仅管理员）
     */
    @GetMapping("/admin/user/{userId}/bundles")
    public ResponseEntity<?> getUserBundles(@PathVariable String userId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以查看
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足"));
            }

            // 查询主账号自己的所有Bundle
            var bundles = bundleService.listAllBundlesByUserId(userId);

            // 查询所有子账号的Bundle
            var subAccounts = userService.getSubAccountsByParentId(userId);
            for (User subAccount : subAccounts) {
                var subBundles = bundleService.listAllBundlesByUserId(subAccount.id);
                bundles.addAll(subBundles);
            }

            // 构建响应
            var bundleList = bundles.stream().map(b -> {
                Map<String, Object> bundleMap = new HashMap<>();
                bundleMap.put("id", b.id);
                bundleMap.put("name", b.name);
                bundleMap.put("host", b.host);
                bundleMap.put("shareMode", b.shareMode);
                bundleMap.put("expireAt", b.expireAt);
                bundleMap.put("createdAt", b.createdAt);
                bundleMap.put("ownerId", b.ownerId);
                return bundleMap;
            }).toList();

            return ResponseEntity.ok(Map.of(
                    "bundles", bundleList,
                    "total", bundleList.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "查询失败"));
        }
    }

    /**
     * 管理员 - 预览孤立数据
     */
    @GetMapping("/admin/cache/preview")
    public ResponseEntity<?> previewOrphanedData() {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以执行清理
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足，只有全局管理员可以执行清理操作"));
            }

            // 预览孤立数据
            OrphanedDataStats stats = cacheCleanupService.previewOrphanedData();

            return ResponseEntity.ok(Map.of(
                    "orphanedSitesCount", stats.orphanedSitesCount,
                    "orphanedUsersCount", stats.orphanedUsersCount,
                    "orphanedGroupsCount", stats.orphanedGroupsCount
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "预览失败"));
        }
    }

    /**
     * 管理员 - 执行缓存清理
     */
    @PostMapping("/admin/cache/cleanup")
    public ResponseEntity<?> executeCleanup() {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String currentUserId = String.valueOf(StpUtil.getLoginId());
            Optional<User> currentUserOpt = userService.getUserById(currentUserId);

            if (currentUserOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("error", "当前用户不存在"));
            }

            User currentUser = currentUserOpt.get();

            // 检查权限：仅GLOBAL_ADMIN可以执行清理
            if (!"GLOBAL_ADMIN".equals(currentUser.role)) {
                return ResponseEntity.status(403).body(Map.of("error", "权限不足，只有全局管理员可以执行清理操作"));
            }

            // 执行清理
            CleanupResult result = cacheCleanupService.executeCleanup(currentUserId);

            return ResponseEntity.ok(Map.of(
                    "ok", true,
                    "message", "清理完成",
                    "deletedSitesCount", result.deletedSitesCount,
                    "deletedUsersCount", result.deletedUsersCount,
                    "deletedGroupsCount", result.deletedGroupsCount
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "清理失败"));
        }
    }

    /**
     * Linux.do OAuth 登录跳转
     */
    @GetMapping("/linuxdo/login")
    public void linuxDoLogin(HttpServletResponse response) throws java.io.IOException {
        String authorizeUrl = linuxDoAuthService.getAuthorizeUrl();
        response.sendRedirect(authorizeUrl);
    }

    /**
     * Linux.do OAuth 回调
     */
    @GetMapping("/linuxdo/callback")
    public void linuxDoCallback(@RequestParam("code") String code, HttpServletResponse response) throws java.io.IOException {
        if (code == null || code.isEmpty()) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Code is missing");
            return;
        }

        // 1. 换取 Token
        String token = linuxDoAuthService.accessToken(code);
        if (token == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Failed to get access token");
            return;
        }

        // 2. 获取用户信息
        com.fasterxml.jackson.databind.JsonNode userInfo = linuxDoAuthService.getUserInfo(token);
        if (userInfo == null) {
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Failed to get user info");
            return;
        }

        String username = userInfo.has("username") ? userInfo.get("username").asText() : null;
        String email = userInfo.has("email") ? userInfo.get("email").asText() : null;

        if (username == null) {
             response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Username missing in user info");
             return;
        }

        // 3. 检查用户是否存在
        Optional<User> userOpt = userService.getUserByUsername(username);
        User user;

        if (userOpt.isPresent()) {
            user = userOpt.get();
        } else {
            // 4. 不存在则自动创建主账号
            String randomPassword = java.util.UUID.randomUUID().toString();
            user = userService.createMainAccountByAdmin(username, randomPassword, email);
        }

        // 5. 登录
        StpUtil.login(user.id);

        // 6. 重定向回首页
        response.sendRedirect("/");
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
