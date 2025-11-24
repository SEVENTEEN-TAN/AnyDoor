// 组管理 Controller
// 提供组创建、成员管理、查询等 API

package app.controller;

import app.mapper.UserMapper;
import app.model.CookieBundle;
import app.model.User;
import app.model.UserGroup;
import app.model.UserGroupRelation;
import app.service.BundleService;
import app.service.GroupService;
import cn.dev33.satoken.stp.StpUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static app.model.table.UserTableDef.USER;

@RestController
@RequestMapping("/api/group")
public class GroupController {

    private final GroupService groupService;
    private final UserMapper userMapper;
    private final BundleService bundleService;

    public GroupController(GroupService groupService, UserMapper userMapper, BundleService bundleService) {
        this.groupService = groupService;
        this.userMapper = userMapper;
        this.bundleService = bundleService;
    }

    public record CreateGroupReq(String groupName, String description) {
    }

    public record AddMemberReq(String username, String roleInGroup) {
    }

    public record UpdateGroupReq(String groupName, String description) {
    }

    /**
     * 创建组
     */
    @PostMapping("/create")
    public ResponseEntity<?> createGroup(@RequestBody CreateGroupReq req) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.groupName())) {
            return ResponseEntity.badRequest().body(Map.of("error", "组名不能为空"));
        }

        try {
            String ownerId = String.valueOf(StpUtil.getLoginId());
            UserGroup group = groupService.createGroup(ownerId, req.groupName(), req.description());

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("groupId", group.id);
            respMap.put("groupName", group.groupName);
            respMap.put("description", group.description);
            return ResponseEntity.ok(respMap);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 添加成员到组
     */
    @PostMapping("/{groupId}/member")
    public ResponseEntity<?> addMember(
            @PathVariable String groupId,
            @RequestBody AddMemberReq req
    ) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        if (req == null || isBlank(req.username())) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名不能为空"));
        }

        try {
            String operatorId = String.valueOf(StpUtil.getLoginId());
            String roleInGroup = req.roleInGroup() != null ? req.roleInGroup() : "MEMBER";

            // 根据用户名查询用户
            User user = userMapper.selectOneByQuery(
                    com.mybatisflex.core.query.QueryWrapper.create()
                            .where(USER.USERNAME.eq(req.username()))
            );

            if (user == null) {
                return ResponseEntity.status(404).body(Map.of("error", "用户不存在"));
            }

            groupService.addMember(groupId, user.id, roleInGroup, operatorId);

            return ResponseEntity.ok(Map.of("ok", true, "message", "成员添加成功"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 从组中移除成员
     */
    @DeleteMapping("/{groupId}/member/{userId}")
    public ResponseEntity<?> removeMember(
            @PathVariable String groupId,
            @PathVariable String userId
    ) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String operatorId = String.valueOf(StpUtil.getLoginId());
            groupService.removeMember(groupId, userId, operatorId);

            return ResponseEntity.ok(Map.of("ok", true, "message", "成员已移除"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 查询我的所有组
     */
    @GetMapping("/my")
    public ResponseEntity<?> getMyGroups() {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        String userId = String.valueOf(StpUtil.getLoginId());
        List<UserGroup> groups = groupService.getUserGroups(userId);

        // 为每个组添加成员数和Bundle数统计
        List<Map<String, Object>> groupsWithStats = groups.stream().map(group -> {
            Map<String, Object> groupMap = new HashMap<>();
            groupMap.put("id", group.id);
            groupMap.put("groupName", group.groupName);
            groupMap.put("ownerId", group.ownerId);
            groupMap.put("description", group.description);
            groupMap.put("status", group.status);
            groupMap.put("maxMembers", group.maxMembers);
            groupMap.put("createdAt", group.createdAt);
            groupMap.put("updatedAt", group.updatedAt);

            // 添加统计信息
            groupMap.put("memberCount", groupService.getGroupMemberCount(group.id));
            groupMap.put("bundleCount", groupService.getGroupBundleCount(group.id));

            return groupMap;
        }).toList();

        return ResponseEntity.ok(Map.of("groups", groupsWithStats));
    }

    /**
     * 查询组详情
     */
    @GetMapping("/{groupId}")
    public ResponseEntity<?> getGroupById(@PathVariable String groupId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        Optional<UserGroup> groupOpt = groupService.getGroupById(groupId);
        if (groupOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "组不存在"));
        }

        UserGroup group = groupOpt.get();
        Map<String, Object> respMap = new HashMap<>();
        respMap.put("id", group.id);
        respMap.put("groupName", group.groupName);
        respMap.put("ownerId", group.ownerId);
        respMap.put("description", group.description);
        respMap.put("status", group.status);
        respMap.put("maxMembers", group.maxMembers);
        respMap.put("createdAt", group.createdAt);

        return ResponseEntity.ok(respMap);
    }

    /**
     * 查询组内成员列表
     */
    @GetMapping("/{groupId}/members")
    public ResponseEntity<?> getGroupMembers(@PathVariable String groupId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        String userId = String.valueOf(StpUtil.getLoginId());

        // 检查用户权限：GLOBAL_ADMIN 或组成员可以查看
        User currentUser = userMapper.selectOneById(userId);
        boolean isAdmin = currentUser != null && "GLOBAL_ADMIN".equals(currentUser.role);
        boolean isInGroup = groupService.isUserInGroup(userId, groupId);

        if (!isAdmin && !isInGroup) {
            return ResponseEntity.status(403).body(Map.of("error", "无权查看此组成员"));
        }

        List<UserGroupRelation> relations = groupService.getGroupMembers(groupId);

        // 关联查询用户信息
        List<Map<String, Object>> members = relations.stream()
                .map(r -> {
                    User user = userMapper.selectOneById(r.userId);
                    Map<String, Object> memberMap = new HashMap<>();
                    memberMap.put("userId", r.userId);
                    memberMap.put("username", user != null ? user.username : "未知用户");
                    memberMap.put("roleInGroup", r.roleInGroup);
                    memberMap.put("joinedAt", r.joinedAt);
                    return memberMap;
                })
                .toList();

        return ResponseEntity.ok(Map.of("members", members));
    }

    /**
     * 更新组信息
     */
    @PutMapping("/{groupId}")
    public ResponseEntity<?> updateGroup(
            @PathVariable String groupId,
            @RequestBody UpdateGroupReq req
    ) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String operatorId = String.valueOf(StpUtil.getLoginId());
            groupService.updateGroup(groupId, req.groupName(), req.description(), operatorId);

            return ResponseEntity.ok(Map.of("ok", true));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 查询用户在组内的角色
     */
    @GetMapping("/{groupId}/my-role")
    public ResponseEntity<?> getMyRole(@PathVariable String groupId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        String userId = String.valueOf(StpUtil.getLoginId());
        Optional<String> roleOpt = groupService.getUserRoleInGroup(userId, groupId);

        if (roleOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "您不在此组内"));
        }

        return ResponseEntity.ok(Map.of("role", roleOpt.get()));
    }

    /**
     * 删除组
     */
    @DeleteMapping("/{groupId}")
    public ResponseEntity<?> deleteGroup(@PathVariable String groupId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        try {
            String operatorId = String.valueOf(StpUtil.getLoginId());
            GroupService.DeleteGroupResult result = groupService.deleteGroup(groupId, operatorId);

            Map<String, Object> respMap = new HashMap<>();
            respMap.put("ok", true);
            respMap.put("message", "组已删除");
            respMap.put("affectedMembers", result.affectedMembers());
            respMap.put("affectedBundles", result.affectedBundles());

            return ResponseEntity.ok(respMap);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "删除失败，请稍后重试"));
        }
    }

    /**
     * 查询组内站点列表
     */
    @GetMapping("/{groupId}/bundles")
    public ResponseEntity<?> getGroupBundles(@PathVariable String groupId) {
        if (!StpUtil.isLogin()) {
            return ResponseEntity.status(401).body(Map.of("error", "未登录"));
        }

        String userId = String.valueOf(StpUtil.getLoginId());

        // 检查用户权限：GLOBAL_ADMIN 或组成员可以查看
        User currentUser = userMapper.selectOneById(userId);
        boolean isAdmin = currentUser != null && "GLOBAL_ADMIN".equals(currentUser.role);
        boolean isInGroup = groupService.isUserInGroup(userId, groupId);

        if (!isAdmin && !isInGroup) {
            return ResponseEntity.status(403).body(Map.of("error", "权限不足，只有组成员可以查看组内站点"));
        }

        // 查询组内站点
        List<CookieBundle> bundles = bundleService.listGroupBundles(groupId);

        // 关联查询所有者信息
        List<Map<String, Object>> bundleDTOs = bundles.stream()
                .map(b -> {
                    User owner = userMapper.selectOneById(b.ownerId);
                    Map<String, Object> bundleMap = new HashMap<>();
                    bundleMap.put("id", b.id);
                    bundleMap.put("name", b.name);
                    bundleMap.put("host", b.host);
                    bundleMap.put("ownerId", b.ownerId);
                    bundleMap.put("ownerName", owner != null ? owner.username : "未知用户");
                    bundleMap.put("shareMode", b.shareMode);
                    bundleMap.put("expireAt", b.expireAt);
                    bundleMap.put("createdAt", b.createdAt);
                    return bundleMap;
                })
                .toList();

        return ResponseEntity.ok(Map.of("bundles", bundleDTOs));
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
