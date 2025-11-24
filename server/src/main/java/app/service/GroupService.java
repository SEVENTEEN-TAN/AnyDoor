// 组管理服务
// 提供组创建、成员管理、权限验证等功能

package app.service;

import app.mapper.CookieBundleMapper;
import app.mapper.UserGroupMapper;
import app.mapper.UserGroupRelationMapper;
import app.mapper.UserMapper;
import app.model.CookieBundle;
import app.model.User;
import app.model.UserGroup;
import app.model.UserGroupRelation;
import com.mybatisflex.core.query.QueryWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static app.model.table.CookieBundleTableDef.COOKIE_BUNDLE;
import static app.model.table.UserGroupRelationTableDef.USER_GROUP_RELATION;
import static app.model.table.UserGroupTableDef.USER_GROUP;

@Service
public class GroupService {
    private final UserGroupMapper groupMapper;
    private final UserGroupRelationMapper relationMapper;
    private final UserMapper userMapper;
    private final CookieBundleMapper bundleMapper;

    public GroupService(
            UserGroupMapper groupMapper,
            UserGroupRelationMapper relationMapper,
            UserMapper userMapper,
            CookieBundleMapper bundleMapper
    ) {
        this.groupMapper = groupMapper;
        this.relationMapper = relationMapper;
        this.userMapper = userMapper;
        this.bundleMapper = bundleMapper;
    }

    /**
     * 创建组
     *
     * @param ownerId     组主账号ID
     * @param groupName   组名
     * @param description 描述
     * @return 创建的组对象
     */
    @Transactional
    public UserGroup createGroup(String ownerId, String groupName, String description) {
        // 1. 检查组名是否已存在
        UserGroup existing = groupMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP.GROUP_NAME.eq(groupName))
        );

        if (existing != null) {
            throw new IllegalArgumentException("组名已存在");
        }

        // 2. 创建组
        UserGroup group = new UserGroup();
        group.id = UUID.randomUUID().toString();
        group.groupName = groupName;
        group.ownerId = ownerId;
        group.description = description;
        group.status = "ACTIVE";
        group.maxMembers = 100;
        group.createdAt = System.currentTimeMillis();
        group.updatedAt = System.currentTimeMillis();

        groupMapper.insert(group);

        // 3. 创建组主账号关系
        UserGroupRelation relation = new UserGroupRelation();
        relation.id = UUID.randomUUID().toString();
        relation.userId = ownerId;
        relation.groupId = group.id;
        relation.roleInGroup = "OWNER";
        relation.joinedAt = System.currentTimeMillis();

        relationMapper.insert(relation);

        // 4. 提升用户角色为 GROUP_OWNER
        User user = userMapper.selectOneById(ownerId);
        if (user != null && !"GLOBAL_ADMIN".equals(user.role)) {
            user.role = "GROUP_OWNER";
            user.updatedAt = System.currentTimeMillis();
            userMapper.update(user);
        }

        return group;
    }

    /**
     * 添加成员到组
     *
     * @param groupId     组ID
     * @param userId      用户ID
     * @param roleInGroup 组内角色（MEMBER / ADMIN）
     * @param operatorId  操作者ID（用于权限验证）
     */
    @Transactional
    public void addMember(String groupId, String userId, String roleInGroup, String operatorId) {
        // 1. 验证操作者权限（必须是 OWNER 或 ADMIN）
        if (!isOwnerOrAdmin(operatorId, groupId)) {
            throw new IllegalStateException("没有权限添加成员");
        }

        // 2. 检查用户是否已在组内
        UserGroupRelation existing = relationMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.USER_ID.eq(userId))
                        .and(USER_GROUP_RELATION.GROUP_ID.eq(groupId))
        );

        if (existing != null) {
            throw new IllegalArgumentException("用户已在组内");
        }

        // 3. 检查组成员数量限制
        UserGroup group = groupMapper.selectOneById(groupId);
        long memberCount = relationMapper.selectCountByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.GROUP_ID.eq(groupId))
        );

        if (memberCount >= group.maxMembers) {
            throw new IllegalStateException("组成员已达上限");
        }

        // 4. 添加成员
        UserGroupRelation relation = new UserGroupRelation();
        relation.id = UUID.randomUUID().toString();
        relation.userId = userId;
        relation.groupId = groupId;
        relation.roleInGroup = roleInGroup;
        relation.joinedAt = System.currentTimeMillis();

        relationMapper.insert(relation);
    }

    /**
     * 从组中移除成员
     *
     * @param groupId    组ID
     * @param userId     用户ID
     * @param operatorId 操作者ID
     */
    @Transactional
    public void removeMember(String groupId, String userId, String operatorId) {
        // 1. 验证操作者权限
        if (!isOwnerOrAdmin(operatorId, groupId)) {
            throw new IllegalStateException("没有权限移除成员");
        }

        // 2. 不能移除组主账号
        UserGroupRelation relation = relationMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.USER_ID.eq(userId))
                        .and(USER_GROUP_RELATION.GROUP_ID.eq(groupId))
        );

        if (relation == null) {
            throw new IllegalArgumentException("用户不在组内");
        }

        if ("OWNER".equals(relation.roleInGroup)) {
            throw new IllegalStateException("不能移除组主账号");
        }

        // 3. 删除关系
        relationMapper.deleteById(relation.id);
    }

    /**
     * 查询用户所在的所有组
     *
     * @param userId 用户ID
     * @return 组列表
     */
    public List<UserGroup> getUserGroups(String userId) {
        // 1. 查询用户的组关系
        List<UserGroupRelation> relations = relationMapper.selectListByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.USER_ID.eq(userId))
        );

        if (relations.isEmpty()) {
            return List.of();
        }

        // 2. 查询组信息
        List<String> groupIds = relations.stream()
                .map(r -> r.groupId)
                .toList();

        return groupMapper.selectListByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP.ID.in(groupIds))
                        .and(USER_GROUP.STATUS.eq("ACTIVE"))
        );
    }

    /**
     * 查询组内所有成员
     *
     * @param groupId 组ID
     * @return 成员列表
     */
    public List<UserGroupRelation> getGroupMembers(String groupId) {
        return relationMapper.selectListByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.GROUP_ID.eq(groupId))
        );
    }

    /**
     * 查询用户在组内的角色
     *
     * @param userId  用户ID
     * @param groupId 组ID
     * @return 角色（OWNER / ADMIN / MEMBER）或空
     */
    public Optional<String> getUserRoleInGroup(String userId, String groupId) {
        UserGroupRelation relation = relationMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.USER_ID.eq(userId))
                        .and(USER_GROUP_RELATION.GROUP_ID.eq(groupId))
        );

        return Optional.ofNullable(relation)
                .map(r -> r.roleInGroup);
    }

    /**
     * 检查用户是否是组的 OWNER 或 ADMIN（或全局管理员）
     *
     * @param userId  用户ID
     * @param groupId 组ID
     * @return true 如果是 OWNER 或 ADMIN 或 GLOBAL_ADMIN
     */
    public boolean isOwnerOrAdmin(String userId, String groupId) {
        // 检查是否是全局管理员
        User user = userMapper.selectOneById(userId);
        if (user != null && "GLOBAL_ADMIN".equals(user.role)) {
            return true;
        }

        // 检查是否是组的 OWNER 或 ADMIN
        Optional<String> role = getUserRoleInGroup(userId, groupId);
        return role.isPresent() &&
                ("OWNER".equals(role.get()) || "ADMIN".equals(role.get()));
    }

    /**
     * 检查用户是否在组内
     *
     * @param userId  用户ID
     * @param groupId 组ID
     * @return true 如果用户在组内
     */
    public boolean isUserInGroup(String userId, String groupId) {
        UserGroupRelation relation = relationMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.USER_ID.eq(userId))
                        .and(USER_GROUP_RELATION.GROUP_ID.eq(groupId))
        );

        return relation != null;
    }

    /**
     * 根据组ID查询组信息
     *
     * @param groupId 组ID
     * @return 组对象
     */
    public Optional<UserGroup> getGroupById(String groupId) {
        UserGroup group = groupMapper.selectOneById(groupId);
        return Optional.ofNullable(group);
    }

    /**
     * 更新组信息
     *
     * @param groupId     组ID
     * @param groupName   组名
     * @param description 描述
     * @param operatorId  操作者ID
     */
    @Transactional
    public void updateGroup(String groupId, String groupName, String description, String operatorId) {
        // 1. 验证操作者权限（必须是 OWNER 或 GLOBAL_ADMIN）
        User operator = userMapper.selectOneById(operatorId);
        boolean isGlobalAdmin = operator != null && "GLOBAL_ADMIN".equals(operator.role);

        if (!isGlobalAdmin) {
            Optional<String> role = getUserRoleInGroup(operatorId, groupId);
            if (role.isEmpty() || !"OWNER".equals(role.get())) {
                throw new IllegalStateException("只有组主账号可以修改组信息");
            }
        }

        // 2. 更新组信息
        UserGroup group = groupMapper.selectOneById(groupId);
        if (group == null) {
            throw new IllegalArgumentException("组不存在");
        }

        if (groupName != null && !groupName.isBlank()) {
            group.groupName = groupName;
        }
        if (description != null) {
            group.description = description;
        }
        group.updatedAt = System.currentTimeMillis();

        groupMapper.update(group);
    }

    /**
     * 查询指定用户作为owner的所有组（管理员用）
     *
     * @param ownerId 用户ID
     * @return 组列表
     */
    public List<UserGroup> getGroupsByOwnerId(String ownerId) {
        return groupMapper.selectListByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP.OWNER_ID.eq(ownerId))
                        .and(USER_GROUP.STATUS.eq("ACTIVE"))
                        .orderBy(USER_GROUP.CREATED_AT.desc())
        );
    }

    /**
     * 获取组成员数量
     *
     * @param groupId 组ID
     * @return 成员数量
     */
    public int getGroupMemberCount(String groupId) {
        long count = relationMapper.selectCountByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.GROUP_ID.eq(groupId))
        );
        return (int) count;
    }

    /**
     * 获取组内Bundle数量
     *
     * @param groupId 组ID
     * @return Bundle数量
     */
    public int getGroupBundleCount(String groupId) {
        long count = bundleMapper.selectCountByQuery(
                QueryWrapper.create()
                        .where(COOKIE_BUNDLE.GROUP_ID.eq(groupId))
                        .and(COOKIE_BUNDLE.EXPIRE_AT.gt(System.currentTimeMillis()))
        );
        return (int) count;
    }

    /**
     * 删除组
     *
     * @param groupId    组ID
     * @param operatorId 操作者ID
     * @return 删除结果（包含受影响的成员数和Bundle数）
     */
    @Transactional
    public DeleteGroupResult deleteGroup(String groupId, String operatorId) {
        // 1. 验证组是否存在
        UserGroup group = groupMapper.selectOneById(groupId);
        if (group == null) {
            throw new IllegalArgumentException("组不存在");
        }

        // 2. 验证权限（必须是组所有者或 GLOBAL_ADMIN）
        User operator = userMapper.selectOneById(operatorId);
        boolean isGlobalAdmin = operator != null && "GLOBAL_ADMIN".equals(operator.role);

        if (!isGlobalAdmin && !group.ownerId.equals(operatorId)) {
            throw new IllegalStateException("权限不足，只有组主账号可以删除组");
        }

        // 3. 统计受影响的数据
        int memberCount = getGroupMemberCount(groupId);
        long bundleCount = bundleMapper.selectCountByQuery(
                QueryWrapper.create()
                        .where(COOKIE_BUNDLE.GROUP_ID.eq(groupId))
        );

        // 4. 删除所有成员关系
        relationMapper.deleteByQuery(
                QueryWrapper.create()
                        .where(USER_GROUP_RELATION.GROUP_ID.eq(groupId))
        );

        // 5. 更新组内 Bundle（设置 group_id=NULL, share_mode=PRIVATE）
        // 查询所有组内 Bundle
        List<CookieBundle> bundles = bundleMapper.selectListByQuery(
                QueryWrapper.create()
                        .where(COOKIE_BUNDLE.GROUP_ID.eq(groupId))
        );

        // 更新每个 Bundle
        for (CookieBundle bundle : bundles) {
            bundle.groupId = null;
            if ("GROUP_ONLY".equals(bundle.shareMode)) {
                bundle.shareMode = "PRIVATE";
            }
            bundle.updatedAt = System.currentTimeMillis();
            bundleMapper.update(bundle);
        }

        // 6. 删除组
        groupMapper.deleteById(groupId);

        // 7. 返回删除结果
        return new DeleteGroupResult(memberCount, (int) bundleCount);
    }

    /**
     * 删除组结果
     */
    public record DeleteGroupResult(int affectedMembers, int affectedBundles) {
    }
}
