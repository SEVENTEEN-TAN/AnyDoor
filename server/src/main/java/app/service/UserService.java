// 用户服务
// 提供用户注册、认证、密码加密等功能

package app.service;

import app.mapper.CookieBundleMapper;
import app.mapper.UserGroupMapper;
import app.mapper.UserGroupRelationMapper;
import app.mapper.UserMapper;
import app.model.CookieBundle;
import app.model.User;
import app.model.UserGroup;
import app.model.UserGroupRelation;
import app.model.dto.SubAccountWithGroupsDTO;
import com.mybatisflex.core.query.QueryWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static app.model.table.CookieBundleTableDef.COOKIE_BUNDLE;
import static app.model.table.UserGroupRelationTableDef.USER_GROUP_RELATION;
import static app.model.table.UserGroupTableDef.USER_GROUP;
import static app.model.table.UserTableDef.USER;

@Service
public class UserService {
    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserMapper userMapper;
    private final UserGroupMapper groupMapper;
    private final UserGroupRelationMapper relationMapper;
    private final CookieBundleMapper cookieBundleMapper;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserService(
            UserMapper userMapper,
            UserGroupMapper groupMapper,
            UserGroupRelationMapper relationMapper,
            CookieBundleMapper cookieBundleMapper
    ) {
        this.userMapper = userMapper;
        this.groupMapper = groupMapper;
        this.relationMapper = relationMapper;
        this.cookieBundleMapper = cookieBundleMapper;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    /**
     * 用户注册
     *
     * @param username 用户名
     * @param password 密码（明文）
     * @param email    邮箱（可选）
     * @return 创建的用户对象
     */
    @Transactional
    public User register(String username, String password, String email) {
        // 1. 检查用户名是否已存在
        User existing = userMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER.USERNAME.eq(username))
        );

        if (existing != null) {
            throw new IllegalArgumentException("用户名已存在");
        }

        // 2. 创建用户
        User user = new User();
        user.id = UUID.randomUUID().toString();
        user.username = username;
        user.passwordHash = passwordEncoder.encode(password);
        user.email = email;
        user.displayName = username;  // 默认显示名称为用户名
        user.role = "NORMAL_USER";
        user.status = "ACTIVE";
        user.createdAt = System.currentTimeMillis();
        user.updatedAt = System.currentTimeMillis();

        userMapper.insert(user);

        return user;
    }

    /**
     * 创建子账号
     *
     * @param parentUserId 父账号ID
     * @param username     用户名
     * @param password     密码（明文）
     * @param email        邮箱（可选）
     * @param groupId      所属组ID（可选，为空则创建默认组）
     * @return 创建的子账号对象
     */
    @Transactional
    public User createSubAccount(String parentUserId, String username, String password, String email, String groupId) {
        // 1. 检查父账号是否存在
        User parentUser = userMapper.selectOneById(parentUserId);
        if (parentUser == null) {
            throw new IllegalArgumentException("父账号不存在");
        }

        // 2. 检查用户名是否已存在
        User existing = userMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER.USERNAME.eq(username))
        );

        if (existing != null) {
            throw new IllegalArgumentException("用户名已存在");
        }

        // 3. 确定组ID：如果未指定，创建或使用默认组
        String finalGroupId = groupId;
        if (finalGroupId == null || finalGroupId.isBlank()) {
            // 查找父账号的默认组（组名为"用户名的默认组"）
            String defaultGroupName = parentUser.username + "的默认组";
            UserGroup defaultGroup = groupMapper.selectOneByQuery(
                    QueryWrapper.create()
                            .where(USER_GROUP.OWNER_ID.eq(parentUserId))
                            .and(USER_GROUP.GROUP_NAME.eq(defaultGroupName))
            );

            if (defaultGroup == null) {
                // 创建默认组
                defaultGroup = new UserGroup();
                defaultGroup.id = UUID.randomUUID().toString();
                defaultGroup.groupName = defaultGroupName;
                defaultGroup.ownerId = parentUserId;
                defaultGroup.description = "默认组";
                defaultGroup.status = "ACTIVE";
                defaultGroup.maxMembers = 100;
                defaultGroup.createdAt = System.currentTimeMillis();
                defaultGroup.updatedAt = System.currentTimeMillis();

                groupMapper.insert(defaultGroup);

                // 创建父账号与默认组的关系（如果不存在）
                UserGroupRelation parentRelation = relationMapper.selectOneByQuery(
                        QueryWrapper.create()
                                .where(USER_GROUP_RELATION.USER_ID.eq(parentUserId))
                                .and(USER_GROUP_RELATION.GROUP_ID.eq(defaultGroup.id))
                );

                if (parentRelation == null) {
                    parentRelation = new UserGroupRelation();
                    parentRelation.id = UUID.randomUUID().toString();
                    parentRelation.userId = parentUserId;
                    parentRelation.groupId = defaultGroup.id;
                    parentRelation.roleInGroup = "OWNER";
                    parentRelation.joinedAt = System.currentTimeMillis();
                    relationMapper.insert(parentRelation);
                }
            }

            finalGroupId = defaultGroup.id;
        }

        // 4. 创建子账号
        User subAccount = new User();
        subAccount.id = UUID.randomUUID().toString();
        subAccount.username = username;
        subAccount.passwordHash = passwordEncoder.encode(password);
        subAccount.email = email;
        subAccount.displayName = username;  // 默认显示名称为用户名
        subAccount.role = "NORMAL_USER";
        subAccount.status = "ACTIVE";
        subAccount.parentUserId = parentUserId;  // 设置父账号ID
        subAccount.createdAt = System.currentTimeMillis();
        subAccount.updatedAt = System.currentTimeMillis();

        userMapper.insert(subAccount);

        // 5. 将子账号加入组
        UserGroupRelation subAccountRelation = new UserGroupRelation();
        subAccountRelation.id = UUID.randomUUID().toString();
        subAccountRelation.userId = subAccount.id;
        subAccountRelation.groupId = finalGroupId;
        subAccountRelation.roleInGroup = "MEMBER";
        subAccountRelation.joinedAt = System.currentTimeMillis();

        relationMapper.insert(subAccountRelation);

        return subAccount;
    }

    /**
     * 用户注册并创建组（组主账号）
     *
     * @param username  用户名
     * @param password  密码
     * @param email     邮箱
     * @param groupName 组名
     * @return 创建的用户对象
     */
    @Transactional
    public User registerWithGroup(String username, String password, String email, String groupName) {
        // 1. 创建用户
        User user = register(username, password, email);

        // 2. 创建组
        UserGroup group = new UserGroup();
        group.id = UUID.randomUUID().toString();
        group.groupName = groupName;
        group.ownerId = user.id;
        group.description = username + " 的团队";
        group.status = "ACTIVE";
        group.maxMembers = 100;
        group.createdAt = System.currentTimeMillis();
        group.updatedAt = System.currentTimeMillis();

        groupMapper.insert(group);

        // 3. 创建用户-组关系（OWNER）
        UserGroupRelation relation = new UserGroupRelation();
        relation.id = UUID.randomUUID().toString();
        relation.userId = user.id;
        relation.groupId = group.id;
        relation.roleInGroup = "OWNER";
        relation.joinedAt = System.currentTimeMillis();

        relationMapper.insert(relation);

        // 4. 提升用户角色为 GROUP_OWNER
        user.role = "GROUP_OWNER";
        user.updatedAt = System.currentTimeMillis();
        userMapper.update(user);

        return user;
    }

    /**
     * 用户认证
     *
     * @param username 用户名
     * @param password 密码（明文）
     * @return 认证成功返回用户对象，失败返回空
     */
    public Optional<User> authenticate(String username, String password) {
        // 1. 查询用户
        User user = userMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER.USERNAME.eq(username))
        );

        if (user == null) {
            return Optional.empty();
        }

        // 2. 检查账号状态
        if (!"ACTIVE".equals(user.status)) {
            throw new IllegalStateException("账号已被禁用");
        }

        // 3. 验证密码
        if (!passwordEncoder.matches(password, user.passwordHash)) {
            return Optional.empty();
        }

        return Optional.of(user);
    }

    /**
     * 根据用户ID查询用户
     *
     * @param userId 用户ID
     * @return 用户对象
     */
    public Optional<User> getUserById(String userId) {
        User user = userMapper.selectOneById(userId);
        return Optional.ofNullable(user);
    }

    /**
     * 根据用户名查询用户
     *
     * @param username 用户名
     * @return 用户对象
     */
    public Optional<User> getUserByUsername(String username) {
        User user = userMapper.selectOneByQuery(
                QueryWrapper.create()
                        .where(USER.USERNAME.eq(username))
        );
        return Optional.ofNullable(user);
    }

    /**
     * 更新密码
     *
     * @param userId      用户ID
     * @param oldPassword 旧密码
     * @param newPassword 新密码
     */
    @Transactional
    public void updatePassword(String userId, String oldPassword, String newPassword) {
        User user = userMapper.selectOneById(userId);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        // 验证旧密码
        if (!passwordEncoder.matches(oldPassword, user.passwordHash)) {
            throw new IllegalArgumentException("旧密码错误");
        }

        // 更新密码
        user.passwordHash = passwordEncoder.encode(newPassword);
        user.updatedAt = System.currentTimeMillis();
        userMapper.update(user);
    }

    /**
     * 更新用户信息
     *
     * @param userId      用户ID
     * @param displayName 显示名称
     * @param email       邮箱
     */
    @Transactional
    public void updateProfile(String userId, String displayName, String email) {
        User user = userMapper.selectOneById(userId);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        if (displayName != null && !displayName.isBlank()) {
            user.displayName = displayName;
        }
        if (email != null && !email.isBlank()) {
            user.email = email;
        }
        user.updatedAt = System.currentTimeMillis();

        userMapper.update(user);
    }

    /**
     * 查询所有主账号（GROUP_OWNER和GLOBAL_ADMIN）
     *
     * @return 主账号列表
     */
    public java.util.List<User> listMainAccounts() {
        return userMapper.selectListByQuery(
                QueryWrapper.create()
                        .where(USER.ROLE.in("GROUP_OWNER", "GLOBAL_ADMIN"))
                        .orderBy(USER.CREATED_AT.desc())
        );
    }

    /**
     * 获取用户的统计信息
     *
     * @param userId 用户ID
     * @return 统计信息Map
     */
    public java.util.Map<String, Object> getUserStats(String userId) {
        java.util.Map<String, Object> stats = new java.util.HashMap<>();

        // 统计Bundle数量（包括主账号和所有子账号的Bundle）
        int bundleCount = 0;

        // 主账号自己的Bundle
        List<CookieBundle> ownBundles = cookieBundleMapper.selectListByQuery(
                QueryWrapper.create().where(COOKIE_BUNDLE.OWNER_ID.eq(userId))
        );
        bundleCount += ownBundles.size();

        // 所有子账号的Bundle
        List<User> subAccounts = userMapper.selectListByQuery(
                QueryWrapper.create().where(USER.PARENT_USER_ID.eq(userId))
        );
        for (User subAccount : subAccounts) {
            List<CookieBundle> subBundles = cookieBundleMapper.selectListByQuery(
                    QueryWrapper.create().where(COOKIE_BUNDLE.OWNER_ID.eq(subAccount.id))
            );
            bundleCount += subBundles.size();
        }

        // 统计成员数量（所有子账号数量）
        int memberCount = subAccounts.size();

        stats.put("userId", userId);
        stats.put("bundleCount", bundleCount);
        stats.put("memberCount", memberCount);

        return stats;
    }

    /**
     * 管理员创建主账号（带默认组）
     *
     * @param username 用户名
     * @param password 密码
     * @param email    邮箱
     * @return 创建的用户对象
     */
    @Transactional
    public User createMainAccountByAdmin(String username, String password, String email) {
        // 创建主账号并自动创建默认组
        String defaultGroupName = username + "的默认组";
        return registerWithGroup(username, password, email, defaultGroupName);
    }

    /**
     * 切换用户状态（停用/启用）
     *
     * @param userId 用户ID
     * @return 更新后的用户对象
     */
    @Transactional
    public User toggleUserStatus(String userId) {
        User user = userMapper.selectOneById(userId);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        // 切换状态
        user.status = "ACTIVE".equals(user.status) ? "DISABLED" : "ACTIVE";
        user.updatedAt = System.currentTimeMillis();
        userMapper.update(user);

        return user;
    }

    /**
     * 删除用户（硬删除）
     *
     * @param userId 用户ID
     */
    @Transactional
    public void deleteUser(String userId) {
        User user = userMapper.selectOneById(userId);
        if (user == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        // 删除用户
        userMapper.deleteById(userId);
    }

    /**
     * 切换主账号状态（连带所有子账号）
     *
     * @param userId 主账号ID
     * @return 受影响的用户数量
     */
    @Transactional
    public int toggleUserStatusWithChildren(String userId) {
        User mainUser = userMapper.selectOneById(userId);
        if (mainUser == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        // 切换主账号状态
        String newStatus = "ACTIVE".equals(mainUser.status) ? "DISABLED" : "ACTIVE";
        mainUser.status = newStatus;
        mainUser.updatedAt = System.currentTimeMillis();
        userMapper.update(mainUser);

        int affectedCount = 1;

        // 切换所有子账号状态
        java.util.List<User> subAccounts = userMapper.selectListByQuery(
                QueryWrapper.create().where(USER.PARENT_USER_ID.eq(userId))
        );
        for (User sub : subAccounts) {
            sub.status = newStatus;
            sub.updatedAt = System.currentTimeMillis();
            userMapper.update(sub);
            affectedCount++;
        }

        return affectedCount;
    }

    /**
     * 删除主账号（连带所有子账号）
     *
     * @param userId 主账号ID
     * @return 被删除的用户数量
     */
    @Transactional
    public int deleteUserWithChildren(String userId) {
        User mainUser = userMapper.selectOneById(userId);
        if (mainUser == null) {
            throw new IllegalArgumentException("用户不存在");
        }

        int deletedCount = 1;

        // 删除所有子账号
        java.util.List<User> subAccounts = userMapper.selectListByQuery(
                QueryWrapper.create().where(USER.PARENT_USER_ID.eq(userId))
        );
        for (User sub : subAccounts) {
            userMapper.deleteById(sub.id);
            deletedCount++;
        }

        // 删除主账号
        userMapper.deleteById(userId);

        return deletedCount;
    }

    /**
     * 查询指定父账号的所有子账号
     *
     * @param parentUserId 父账号ID
     * @return 子账号列表
     */
    public java.util.List<User> getSubAccountsByParentId(String parentUserId) {
        return userMapper.selectListByQuery(
                QueryWrapper.create()
                        .where(USER.PARENT_USER_ID.eq(parentUserId))
                        .orderBy(USER.CREATED_AT.desc())
        );
    }

    /**
     * 查询当前用户的所有子账号
     *
     * @param currentUserId 当前用户ID
     * @return 子账号列表
     */
    public java.util.List<User> getSubAccountsByCurrentUser(String currentUserId) {
        return getSubAccountsByParentId(currentUserId);
    }

    /**
     * 查询子账号列表（含所属组信息）
     *
     * @param parentUserId 父账号ID
     * @return 子账号列表（含所属组）
     */
    public List<SubAccountWithGroupsDTO> getSubAccountsWithGroups(String parentUserId) {
        // 查询子账号
        List<User> subAccounts = userMapper.selectListByQuery(
                QueryWrapper.create()
                        .where(USER.PARENT_USER_ID.eq(parentUserId))
                        .orderBy(USER.CREATED_AT.desc())
        );

        // 为每个子账号查询所属组
        return subAccounts.stream()
                .map(user -> {
                    List<UserGroupRelation> relations = relationMapper.selectListByQuery(
                            QueryWrapper.create().where(USER_GROUP_RELATION.USER_ID.eq(user.id))
                    );

                    List<String> groupNames = relations.stream()
                            .map(r -> {
                                UserGroup group = groupMapper.selectOneById(r.groupId);
                                return group != null ? group.groupName : null;
                            })
                            .filter(Objects::nonNull)
                            .sorted()  // 按字母顺序排序
                            .collect(Collectors.toList());

                    return new SubAccountWithGroupsDTO(
                            user.id,
                            user.username,
                            user.email,
                            user.status,
                            user.createdAt,
                            groupNames
                    );
                })
                .collect(Collectors.toList());
    }

    /**
     * 更新子账号信息（密码和所属组）
     *
     * @param subAccountId 子账号ID
     * @param operatorId   操作者ID
     * @param password     新密码（可选）
     * @param groupId      新所属组ID（可选）
     */
    @Transactional
    public void updateSubAccount(String subAccountId, String operatorId, String password, String groupId) {
        // 验证子账号存在
        User subAccount = userMapper.selectOneById(subAccountId);
        if (subAccount == null) {
            throw new IllegalArgumentException("子账号不存在");
        }

        // 验证操作者是父账号
        if (!operatorId.equals(subAccount.parentUserId)) {
            throw new IllegalStateException("权限不足，只有主账号可以编辑其子账号");
        }

        // 更新密码
        if (password != null && !password.isBlank()) {
            // 验证密码长度
            if (password.length() < 6) {
                throw new IllegalArgumentException("密码至少需要6位");
            }
            subAccount.passwordHash = passwordEncoder.encode(password);
        }

        // 更新所属组
        if (groupId != null && !groupId.isBlank()) {
            // 验证组是否存在
            UserGroup group = groupMapper.selectOneById(groupId);
            if (group == null) {
                throw new IllegalArgumentException("所属组不存在");
            }

            // 删除旧的组关联
            relationMapper.deleteByQuery(
                    QueryWrapper.create().where(USER_GROUP_RELATION.USER_ID.eq(subAccountId))
            );

            // 创建新的组关联
            UserGroupRelation newRelation = new UserGroupRelation();
            newRelation.id = UUID.randomUUID().toString();
            newRelation.userId = subAccountId;
            newRelation.groupId = groupId;
            newRelation.roleInGroup = "MEMBER";
            newRelation.joinedAt = System.currentTimeMillis();
            relationMapper.insert(newRelation);
        }

        subAccount.updatedAt = System.currentTimeMillis();
        userMapper.update(subAccount);

        log.info("SubAccount updated: subAccountId={}, operatorId={}, passwordChanged={}, groupChanged={}",
                subAccountId, operatorId, password != null, groupId != null);
    }

    /**
     * 级联删除子账号及其所有关联数据
     *
     * @param subAccountId 子账号ID
     * @param operatorId   操作者ID
     * @return 删除的站点数量
     */
    @Transactional
    public int deleteSubAccountWithCascade(String subAccountId, String operatorId) {
        // 验证子账号存在
        User subAccount = userMapper.selectOneById(subAccountId);
        if (subAccount == null) {
            throw new IllegalArgumentException("子账号不存在");
        }

        // 验证操作者是父账号
        if (!operatorId.equals(subAccount.parentUserId)) {
            throw new IllegalStateException("权限不足，只有主账号可以删除其子账号");
        }

        // 1. 删除子账号创建的所有站点
        List<CookieBundle> bundles = cookieBundleMapper.selectListByQuery(
                QueryWrapper.create().where(COOKIE_BUNDLE.OWNER_ID.eq(subAccountId))
        );

        int deletedBundlesCount = 0;
        for (CookieBundle bundle : bundles) {
            // 删除站点（Cookie 数据存储在 payload 字段中，一起删除）
            cookieBundleMapper.deleteById(bundle.id);
            deletedBundlesCount++;
        }

        log.info("Deleted {} bundles owned by subAccount {}", deletedBundlesCount, subAccountId);

        // 2. 删除子账号的组关联关系
        relationMapper.deleteByQuery(
                QueryWrapper.create().where(USER_GROUP_RELATION.USER_ID.eq(subAccountId))
        );

        // 3. 删除子账号
        userMapper.deleteById(subAccountId);

        log.info("SubAccount deleted with cascade: subAccountId={}, operatorId={}, bundlesDeleted={}",
                subAccountId, operatorId, deletedBundlesCount);

        return deletedBundlesCount;
    }
}
