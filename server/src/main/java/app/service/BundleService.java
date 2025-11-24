// v3.0: Bundle 上传与管理
// 支持 Bundle 的创建、更新、删除和自动过期

package app.service;

import app.mapper.BundleShareMapper;
import app.mapper.CookieBundleMapper;
import app.mapper.UserBundleReferenceMapper;
import app.mapper.UserMapper;
import app.model.BundleShare;
import app.model.CookieBundle;
import app.model.UserBundleReference;
import app.model.UserGroup;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

import static app.model.table.BundleShareTableDef.BUNDLE_SHARE;
import static app.model.table.CookieBundleTableDef.COOKIE_BUNDLE;
import static app.model.table.UserBundleReferenceTableDef.USER_BUNDLE_REFERENCE;

@Service
public class BundleService {
    private final CookieBundleMapper mapper;
    private final UserBundleReferenceMapper referenceMapper;
    private final CryptoService crypto;
    private final GroupService groupService;
    private final BundleShareMapper bundleShareMapper;
    private final UserMapper userMapper;

    public BundleService(
            CryptoService crypto,
            CookieBundleMapper mapper,
            UserBundleReferenceMapper referenceMapper,
            GroupService groupService,
            BundleShareMapper bundleShareMapper,
            UserMapper userMapper
    ) {
        this.crypto = crypto;
        this.mapper = mapper;
        this.referenceMapper = referenceMapper;
        this.groupService = groupService;
        this.bundleShareMapper = bundleShareMapper;
        this.userMapper = userMapper;
    }

    /**
     * 创建 Bundle(v3.0 完整版)
     *
     * @param ownerId     所有者ID
     * @param groupId     组ID(可以为null)
     * @param name        Bundle名称
     * @param shareMode   分享模式(GROUP_ONLY/PUBLIC)
     * @param description 描述(可选)
     * @param tags        标签(可选)
     * @param host        站点hostname
     * @param etld1       eTLD+1
     * @param expireDays  有效天数
     * @param jsonPayload JSON数据
     * @return 创建的Bundle实例
     */
    @Transactional
    public CookieBundle save(
            String ownerId,
            String groupId,
            String name,
            String shareMode,
            String description,
            String tags,
            String host,
            String etld1,
            int expireDays,
            String jsonPayload
    ) {
        // 1. 创建 Bundle
        CookieBundle b = new CookieBundle();
        b.id = UUID.randomUUID().toString();
        b.ownerId = ownerId;
        b.groupId = groupId;
        b.shareMode = shareMode != null ? shareMode : "GROUP_ONLY";
        b.name = name;
        b.description = description;
        b.tags = tags;
        b.host = host;
        b.etld1 = etld1;
        b.createdAt = System.currentTimeMillis();
        b.expireAt = b.createdAt + (long) expireDays * 24 * 3600 * 1000;
        b.accessCount = 0;
        b.payload = crypto.encrypt(jsonPayload);

        mapper.insert(b);

        // 2. 创建 OWNER 引用
        UserBundleReference ref = new UserBundleReference();
        ref.id = UUID.randomUUID().toString();
        ref.userId = ownerId;
        ref.bundleId = b.id;
        ref.referenceType = "OWNER";
        ref.isVisible = true;

        referenceMapper.insert(ref);

        return b;
    }

    /**
     * MVP 简易版本
     */
    @Transactional
    public CookieBundle save(String ownerId, String host, String etld1, String jsonPayload) {
        return save(ownerId, null, host, "GROUP_ONLY", null, null, host, etld1, 7, jsonPayload);
    }

    public Optional<CookieBundle> get(String id) {
        CookieBundle b = mapper.selectOneById(id);
        if (b == null) return Optional.empty();
        if (b.expireAt > 0 && b.expireAt < System.currentTimeMillis()) return Optional.empty();
        return Optional.of(b);
    }

    /**
     * 查询用户可见的 Bundle 列表
     *
     * @param userId 用户ID
     * @return Bundle 列表(带来源信息)
     */
    public java.util.List<BundleWithType> listUserBundles(String userId) {
        long now = System.currentTimeMillis();
        // Use a Map to deduplicate by ID, value is the BundleWithType
        java.util.Map<String, BundleWithType> resultMap = new java.util.HashMap<>();

        // 1. 查询"我的站点"(ownerId = userId)
        var myBundles = mapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(COOKIE_BUNDLE.OWNER_ID.eq(userId))
                        .and(COOKIE_BUNDLE.EXPIRE_AT.gt(now))
        );

        for (var bundle : myBundles) {
            resultMap.put(bundle.id, new BundleWithType(
                    bundle.id,
                    bundle.name,
                    bundle.host,
                    bundle.etld1,
                    bundle.ownerId,
                    bundle.groupId,
                    bundle.shareMode,
                    "OWNER",
                    bundle.expireAt
            ));
        }

        // 2. 查询"已导入的站点"
        // 2a. 查询用户手动导入的Bundle(type=IMPORTED)
        var references = referenceMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(USER_BUNDLE_REFERENCE.USER_ID.eq(userId))
                        .and(USER_BUNDLE_REFERENCE.REFERENCE_TYPE.eq("IMPORTED"))
                        .and(USER_BUNDLE_REFERENCE.IS_VISIBLE.eq(true))
        );

        if (!references.isEmpty()) {
            var bundleIds = references.stream().map(r -> r.bundleId).toList();
            var importedBundles = mapper.selectListByQuery(
                    com.mybatisflex.core.query.QueryWrapper.create()
                            .where(COOKIE_BUNDLE.ID.in(bundleIds))
                            .and(COOKIE_BUNDLE.EXPIRE_AT.gt(now))
            );

            for (var bundle : importedBundles) {
                if (!resultMap.containsKey(bundle.id)) {
                    resultMap.put(bundle.id, new BundleWithType(
                            bundle.id,
                            bundle.name,
                            bundle.host,
                            bundle.etld1,
                            bundle.ownerId,
                            bundle.groupId,
                            bundle.shareMode,
                            "IMPORTED",
                            bundle.expireAt
                    ));
                }
            }
        }

        // 3. 查询"公开站点"
        var publicBundles = mapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(COOKIE_BUNDLE.SHARE_MODE.eq("PUBLIC"))
                        .and(COOKIE_BUNDLE.EXPIRE_AT.gt(now))
                        .and(COOKIE_BUNDLE.OWNER_ID.ne(userId))
        );

        for (var bundle : publicBundles) {
            if (!resultMap.containsKey(bundle.id)) {
                resultMap.put(bundle.id, new BundleWithType(
                        bundle.id,
                        bundle.name,
                        bundle.host,
                        bundle.etld1,
                        bundle.ownerId,
                        bundle.groupId,
                        bundle.shareMode,
                        "PUBLIC",
                        bundle.expireAt
                ));
            }
        }

        // 4. 查询属于共享组的Bundle(shareMode=GROUP_ONLY 且用户在这些组内)
        var userGroups = groupService.getUserGroups(userId);
        if (!userGroups.isEmpty()) {
            var userGroupIds = userGroups.stream()
                    .map(g -> g.id)
                    .toList();

            var groupBundles = mapper.selectListByQuery(
                    com.mybatisflex.core.query.QueryWrapper.create()
                            .where(COOKIE_BUNDLE.SHARE_MODE.eq("GROUP_ONLY"))
                            .and(COOKIE_BUNDLE.GROUP_ID.in(userGroupIds))
                            .and(COOKIE_BUNDLE.EXPIRE_AT.gt(now))
                            .and(COOKIE_BUNDLE.OWNER_ID.ne(userId)) // 排除自己
            );

            for (var bundle : groupBundles) {
                if (!resultMap.containsKey(bundle.id)) {
                    resultMap.put(bundle.id, new BundleWithType(
                            bundle.id,
                            bundle.name,
                            bundle.host,
                            bundle.etld1,
                            bundle.ownerId,
                            bundle.groupId,
                            bundle.shareMode,
                            "GROUP_SHARED",
                            bundle.expireAt
                    ));
                }
            }
        }

        return new java.util.ArrayList<>(resultMap.values());
    }
    /**
     * 查询用户所在的所有组
     *
     * @param userId 用户ID
     * @return 组列表
     */
    public java.util.List<UserGroup> getUserGroups(String userId) {
        return groupService.getUserGroups(userId);
    }

    /**
     * 导入 Bundle(创建 IMPORTED 引用)
     * <p>
     * 权限规则:
     * - PRIVATE: 任何知道bundleId的人都可以导入(私钥分享模式)
     * - GROUP_ONLY: 需要在同一个组
     * - PUBLIC: 任何人都可以导入
     *
     * @param userId   用户ID
     * @param bundleId Bundle ID
     * @return 是否成功
     */
    @Transactional
    public boolean importBundle(String userId, String bundleId) {
        // 1. 检查 Bundle 是否存在
        var bundleOpt = get(bundleId);
        if (bundleOpt.isEmpty()) return false;

        var bundle = bundleOpt.get();

        // 2. 检查权限,根据分享模式判断是否可以导入
        boolean canImport = false;

        // 2.1 如果是所有者,可以导入(虽然没必要)
        if (userId.equals(bundle.ownerId)) {
            canImport = true;
        }
        // 2.2 如果是PRIVATE,任何知道bundleId的人都可以导入(私钥分享)
        else if ("GLOBAL".equals(bundle.shareMode)) {
            canImport = true;
        }
        // 2.4 如果是GROUP_ONLY,需要检查是否在同一组
        else if ("GROUP_ONLY".equals(bundle.shareMode) && bundle.groupId != null) {
            canImport = groupService.isUserInGroup(userId, bundle.groupId);
        }

        // 如果没有权限,返回失败
        if (!canImport) {
            return false;
        }

        // 3. 检查是否已经导入过,避免重复导入
        var existing = referenceMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(USER_BUNDLE_REFERENCE.USER_ID.eq(userId))
                        .and(USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(bundleId))
        );

        if (!existing.isEmpty()) {
            // 已存在,设置为可见
            for (var ref : existing) {
                if (!ref.isVisible) {
                    ref.isVisible = true;
                    referenceMapper.update(ref);
                }
            }
            return true;
        }

        // 4. 创建 IMPORTED 引用
        UserBundleReference ref = new UserBundleReference();
        ref.id = UUID.randomUUID().toString();
        ref.userId = userId;
        ref.bundleId = bundleId;
        ref.referenceType = "IMPORTED";
        ref.isVisible = true;
        ref.importedAt = System.currentTimeMillis();

        referenceMapper.insert(ref);
        return true;
    }

    /**
     * 修改 Bundle 分享模式
     *
     * @param userId    用户ID
     * @param bundleId  Bundle ID
     * @param shareMode 新的分享模式
     * @return 是否成功
     */
    @Transactional
    public boolean updateShareMode(String userId, String bundleId, String shareMode) {
        // 1. 检查 Bundle 是否存在
        var bundleOpt = get(bundleId);
        if (bundleOpt.isEmpty()) return false;

        var bundle = bundleOpt.get();

        // 2. 检查是否为所有者
        if (!userId.equals(bundle.ownerId)) {
            return false;
        }

        // 3. 更新分享模式
        bundle.shareMode = shareMode;
        mapper.update(bundle);

        return true;
    }

    /**
     * 删除Bundle(仅限所有者)
     *
     * @param bundleId Bundle ID
     * @param userId   用户ID
     * @return 是否成功
     */
    @Transactional
    public boolean deleteBundle(String bundleId, String userId) {
        // 1. 查询Bundle
        CookieBundle bundle = mapper.selectOneById(bundleId);
        if (bundle == null) {
            throw new IllegalArgumentException("Bundle不存在");
        }

        // 2. 检查所有权
        if (!userId.equals(bundle.ownerId)) {
            throw new IllegalArgumentException("无权删除该Bundle");
        }

        // 3. 查询活跃的分享记录
        java.util.List<app.model.BundleShare> activeShares = bundleShareMapper.selectListByQuery(
            com.mybatisflex.core.query.QueryWrapper.create()
                .where(app.model.table.BundleShareTableDef.BUNDLE_SHARE.BUNDLE_ID.eq(bundleId))
                .and(app.model.table.BundleShareTableDef.BUNDLE_SHARE.STATUS.eq("ACTIVE"))
        );
        
        // 4. 更新所有分享记录状态为 DELETED
        for (app.model.BundleShare share : activeShares) {
            share.status = "DELETED";
            bundleShareMapper.update(share);
        }
        
        // 5. 隐藏所有被分享人的引用记录
        java.util.List<UserBundleReference> references = referenceMapper.selectListByQuery(
            com.mybatisflex.core.query.QueryWrapper.create()
                .where(app.model.table.UserBundleReferenceTableDef.USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(bundleId))
                .and(app.model.table.UserBundleReferenceTableDef.USER_BUNDLE_REFERENCE.REFERENCE_TYPE.eq("IMPORTED"))
        );
        
        for (UserBundleReference ref : references) {
            ref.isVisible = false;
            referenceMapper.update(ref);
        }

        // 6. 删除Bundle
        int deleted = mapper.deleteById(bundleId);

        // 7. 删除所有引用记录
        referenceMapper.deleteByQuery(
            com.mybatisflex.core.query.QueryWrapper.create()
                .where(app.model.table.UserBundleReferenceTableDef.USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(bundleId))
        );
        
        System.out.println("Bundle deleted: bundleId=" + bundleId + ", activeShares=" + activeShares.size() + ", affectedUsers=" + references.size());

        return deleted > 0;
    }

    /**
     * 移除已导入的Bundle引用
     *
     * @param bundleId Bundle ID
     * @param userId   用户ID
     * @return 是否成功
     */
    @Transactional
    public boolean removeReference(String bundleId, String userId) {
        // 1. 查询引用记录
        UserBundleReference ref = referenceMapper.selectOneByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(app.model.table.UserBundleReferenceTableDef.USER_BUNDLE_REFERENCE.USER_ID.eq(userId))
                        .and(app.model.table.UserBundleReferenceTableDef.USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(bundleId))
        );

        if (ref == null) {
            throw new IllegalArgumentException("未找到引用记录");
        }

        // 2. 将引用记录设置为不可见（软删除）
        ref.isVisible = false;
        referenceMapper.update(ref);
        
        System.out.println("Reference closed: bundleId=" + bundleId + ", userId=" + userId);

        return true;
    }

    /**
     * Bundle 带类型信息的 DTO
     */
    public record BundleWithType(
            String id,
            String name,
            String host,
            String etld1,
            String ownerId,
            String groupId,    // 所属组ID
            String shareMode,  // GROUP_ONLY | PUBLIC
            String type,  // OWNER | GROUP_SHARED | IMPORTED | PUBLIC
            long expireAt
    ) {
    }

    /**
     * 管理员查询指定用户的所有Bundle(不受分享模式限制)
     *
     * @param userId 用户ID
     * @return Bundle列表
     */
    public java.util.List<CookieBundle> listAllBundlesByUserId(String userId) {
        long now = System.currentTimeMillis();
        return mapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(COOKIE_BUNDLE.OWNER_ID.eq(userId))
                        .and(COOKIE_BUNDLE.EXPIRE_AT.gt(now))
                        .orderBy(COOKIE_BUNDLE.CREATED_AT.desc())
        );
    }

    /**
     * 更新Bundle信息
     *
     * @param userId      用户ID
     * @param bundleId    Bundle ID
     * @param name        名称
     * @param description 描述
     * @param tags        标签
     * @param shareMode   分享模式
     * @param groupId     组ID
     * @param expireDays  有效天数(从现在开始计算)
     * @return 是否成功
     */
    @Transactional
    public boolean updateBundle(
            String userId,
            String bundleId,
            String name,
            String description,
            String tags,
            String shareMode,
            String groupId,
            Integer expireDays
    ) {
        // 1. 查询Bundle
        CookieBundle bundle = mapper.selectOneById(bundleId);
        if (bundle == null) {
            throw new IllegalArgumentException("Bundle不存在");
        }

        // 2. 检查所有权
        if (!userId.equals(bundle.ownerId)) {
            throw new IllegalArgumentException("无权修改该Bundle");
        }

        // 3. 更新字段
        boolean updated = false;

        if (name != null && !name.isBlank() && !name.equals(bundle.name)) {
            bundle.name = name;
            updated = true;
        }

        if (description != null && !description.equals(bundle.description)) {
            bundle.description = description;
            updated = true;
        }

        if (tags != null && !tags.equals(bundle.tags)) {
            bundle.tags = tags;
            updated = true;
        }

        if (shareMode != null && !shareMode.isBlank()) {
            // 验证分享模式
            if (!"GROUP_ONLY".equals(shareMode) && !"PRIVATE".equals(shareMode) && !"PUBLIC".equals(shareMode)) {
                throw new IllegalArgumentException("分享模式只能是 GROUP_ONLY, PRIVATE 或 PUBLIC");
            }

            if (!shareMode.equals(bundle.shareMode)) {
                bundle.shareMode = shareMode;
                updated = true;
            }
        }

        if (groupId != null && !groupId.equals(bundle.groupId)) {
            bundle.groupId = groupId.isBlank() ? null : groupId;
            updated = true;
        }

        if (expireDays != null && expireDays > 0 && expireDays <= 365) {
            long newExpireAt = System.currentTimeMillis() + (long) expireDays * 24 * 3600 * 1000;
            if (newExpireAt != bundle.expireAt) {
                bundle.expireAt = newExpireAt;
                updated = true;
            }
        }

        // 4. 如果有更新,执行保存
        if (updated) {
            bundle.updatedAt = System.currentTimeMillis();
            mapper.update(bundle);
        }

        return updated;
    }

    /**
     * 检查用户是否在指定的组
     *
     * @param userId  用户ID
     * @param groupId 组ID
     * @return true 表示用户在组内
     */
    public boolean isUserInGroup(String userId, String groupId) {
        return groupService.isUserInGroup(userId, groupId);
    }

    /**
     * 检查用户是否有该Bundle的引用(已导入或拥有)
     *
     * @param userId   用户ID
     * @param bundleId Bundle ID
     * @return true 表示用户有该Bundle的可见引用
     */
    public boolean hasReference(String userId, String bundleId) {
        var references = referenceMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(USER_BUNDLE_REFERENCE.USER_ID.eq(userId))
                        .and(USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(bundleId))
                        .and(USER_BUNDLE_REFERENCE.IS_VISIBLE.eq(true))
        );
        return !references.isEmpty();
    }

    /**
     * 查询组内所有站点
     *
     * @param groupId 组ID
     * @return 站点列表
     */
    public java.util.List<CookieBundle> listGroupBundles(String groupId) {
        long now = System.currentTimeMillis();
        return mapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(COOKIE_BUNDLE.GROUP_ID.eq(groupId))
                        .and(COOKIE_BUNDLE.EXPIRE_AT.gt(now))
                        .orderBy(COOKIE_BUNDLE.CREATED_AT.desc())
        );
    }

    /**
     * 统计组内Bundle数量
     *
     * @param groupId 组ID
     * @return Bundle数量
     */
    public int countBundlesByGroupId(String groupId) {
        long now = System.currentTimeMillis();
        return (int) mapper.selectCountByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(COOKIE_BUNDLE.GROUP_ID.eq(groupId))
                        .and(COOKIE_BUNDLE.EXPIRE_AT.gt(now))
        );
    }

    // ============================================
    // 分享链接功能(v3.1 新增)
    // ============================================


    /**
     * 创建分享记录
     *
     * @param bundleId Bundle ID
     * @param ownerId  所有者ID
     * @return 分享记录
     */
    @Transactional
    public BundleShare createShare(String bundleId, String ownerId) {
        // 1. 验证 Bundle 存在且用户是所有者
        CookieBundle bundle = mapper.selectOneById(bundleId);
        if (bundle == null || !bundle.ownerId.equals(ownerId)) {
            throw new IllegalArgumentException("Bundle不存在或无权限");
        }

        // 2. 创建分享记录
        BundleShare share = new BundleShare();
        share.id = UUID.randomUUID().toString();
        share.bundleId = bundleId;
        share.ownerId = ownerId;
        share.shareToken = generateShareToken();
        share.status = "ACTIVE";
        share.usedCount = 0;
        share.createdAt = System.currentTimeMillis();

        bundleShareMapper.insert(share);

        return share;
    }

    /**
     * 查询分享记录列表
     *
     * @param bundleId Bundle ID
     * @param ownerId  所有者ID
     * @return 分享记录列表
     */
    public java.util.List<BundleShare> listShares(String bundleId, String ownerId) {
        // 验证所有者权限
        CookieBundle bundle = mapper.selectOneById(bundleId);
        if (bundle == null || !bundle.ownerId.equals(ownerId)) {
            throw new IllegalArgumentException("Bundle不存在或无权限");
        }

        return bundleShareMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(BUNDLE_SHARE.BUNDLE_ID.eq(bundleId))
                        .orderBy(BUNDLE_SHARE.CREATED_AT.desc())
        );
    }

    /**
     * 查询分享记录列表（包含实际用户数量）
     *
     * @param bundleId Bundle ID
     * @param ownerId  所有者ID
     * @return 分享记录列表（包含 actualUserCount 字段）
     */
    public java.util.List<java.util.Map<String, Object>> listSharesWithUserCount(String bundleId, String ownerId) {
        // 验证所有者权限
        CookieBundle bundle = mapper.selectOneById(bundleId);
        if (bundle == null || !bundle.ownerId.equals(ownerId)) {
            throw new IllegalArgumentException("Bundle不存在或无权限");
        }

        java.util.List<BundleShare> shares = bundleShareMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(BUNDLE_SHARE.BUNDLE_ID.eq(bundleId))
                        .orderBy(BUNDLE_SHARE.CREATED_AT.desc())
        );

        // 为每个分享记录计算实际用户数量
        java.util.List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
        for (BundleShare share : shares) {
            // 查询通过该分享导入的用户数量（去重，只统计可见的）
            java.util.List<UserBundleReference> references = referenceMapper.selectListByQuery(
                    com.mybatisflex.core.query.QueryWrapper.create()
                            .where(USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(bundleId))
                            .and(USER_BUNDLE_REFERENCE.REFERENCE_TYPE.eq("IMPORTED"))
                            .and(USER_BUNDLE_REFERENCE.SHARE_ID.eq(share.id))
                            .and(USER_BUNDLE_REFERENCE.IS_VISIBLE.eq(true))
            );

            // 去重统计用户数量
            long actualUserCount = references.stream()
                    .map(ref -> ref.userId)
                    .distinct()
                    .count();

            // 构建返回数据
            java.util.Map<String, Object> shareData = new java.util.HashMap<>();
            shareData.put("id", share.id);
            shareData.put("bundleId", share.bundleId);
            shareData.put("ownerId", share.ownerId);
            shareData.put("shareToken", share.shareToken);
            shareData.put("status", share.status);
            shareData.put("usedCount", share.usedCount); // 保留原始导入次数
            shareData.put("actualUserCount", actualUserCount); // 实际用户数量
            shareData.put("createdAt", share.createdAt);
            shareData.put("lastUsedAt", share.lastUsedAt);
            shareData.put("revokedAt", share.revokedAt);

            result.add(shareData);
        }

        return result;
    }

    /**
     * 撤销分享记录
     *
     * @param shareId 分享记录ID
     * @param ownerId 所有者ID
     */
    @Transactional
    public void revokeShare(String shareId, String ownerId) {
        // 1. 查询分享记录
        BundleShare share = bundleShareMapper.selectOneById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("分享记录不存在");
        }

        // 2. 验证所有者权限
        if (!share.ownerId.equals(ownerId)) {
            throw new IllegalArgumentException("无权撤销该分享");
        }

        // 3. 更新分享状态为 REVOKED
        share.status = "REVOKED";
        share.revokedAt = System.currentTimeMillis();
        bundleShareMapper.update(share);

        // 4. 隐藏所有通过该分享导入的引用记录
        java.util.List<UserBundleReference> references = referenceMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(share.bundleId))
                        .and(USER_BUNDLE_REFERENCE.REFERENCE_TYPE.eq("IMPORTED"))
                        .and(USER_BUNDLE_REFERENCE.SHARE_ID.eq(shareId))
        );

        for (UserBundleReference ref : references) {
            ref.isVisible = false;
            referenceMapper.update(ref);
        }

        System.out.println("Share revoked: shareId=" + shareId + ", bundleId=" + share.bundleId + ", affectedUsers=" + references.size());
    }

    /**
     * 通过 share_token 导入站点
     *
     * @param userId     用户ID
     * @param shareToken 分享令牌
     * @return 是否成功
     */
    @Transactional
    public boolean importByToken(String userId, String shareToken) {
        // 1. 查询分享记录
        BundleShare share = bundleShareMapper.selectOneByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(BUNDLE_SHARE.SHARE_TOKEN.eq(shareToken))
        );

        if (share == null) {
            throw new IllegalArgumentException("分享令牌无效");
        }

        // 2. 验证分享状态
        if (!"ACTIVE".equals(share.status)) {
            throw new IllegalArgumentException("分享已失效");
        }

        // 3. 验证 Bundle 是否存在且未过期
        var bundleOpt = get(share.bundleId);
        if (bundleOpt.isEmpty()) {
            throw new IllegalArgumentException("站点不存在或已过期");
        }

        // 4. 检查是否已经导入过
        var existing = referenceMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(USER_BUNDLE_REFERENCE.USER_ID.eq(userId))
                        .and(USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(share.bundleId))
        );

        if (!existing.isEmpty()) {
            // 已存在,设置为可见
            for (var ref : existing) {
                if (!ref.isVisible) {
                    ref.isVisible = true;
                    ref.shareId = share.id;
                    referenceMapper.update(ref);
                }
            }
        } else {
            // 5. 创建 IMPORTED 引用
            UserBundleReference ref = new UserBundleReference();
            ref.id = UUID.randomUUID().toString();
            ref.userId = userId;
            ref.bundleId = share.bundleId;
            ref.referenceType = "IMPORTED";
            ref.isVisible = true;
            ref.shareId = share.id;
            ref.importedAt = System.currentTimeMillis();

            referenceMapper.insert(ref);
        }

        // 6. 更新分享使用统计
        share.usedCount++;
        share.lastUsedAt = System.currentTimeMillis();
        bundleShareMapper.update(share);

        return true;
    }

    /**
     * 获取分享使用者列表
     *
     * @param shareId 分享记录ID
     * @param ownerId 所有者ID
     * @return 使用者列表
     */
    public java.util.List<java.util.Map<String, Object>> getShareUsers(String shareId, String ownerId) {
        // 1. 查询分享记录
        BundleShare share = bundleShareMapper.selectOneById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("分享记录不存在");
        }

        // 2. 验证所有者权限
        if (!share.ownerId.equals(ownerId)) {
            throw new IllegalArgumentException("无权限查看该分享的使用者");
        }

        // 3. 查询所有通过该分享导入的用户引用记录
        java.util.List<UserBundleReference> references = referenceMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(share.bundleId))
                        .and(USER_BUNDLE_REFERENCE.REFERENCE_TYPE.eq("IMPORTED"))
                        .and(USER_BUNDLE_REFERENCE.SHARE_ID.eq(shareId))
        );

        // 4. 构建返回结果，包含用户信息
        java.util.List<java.util.Map<String, Object>> users = new java.util.ArrayList<>();
        for (UserBundleReference ref : references) {
            // 查询用户信息
            var userOpt = userMapper.selectOneById(ref.userId);
            String username = userOpt != null ? userOpt.username : ref.userId;

            users.add(java.util.Map.of(
                    "userId", ref.userId,
                    "username", username,
                    "importedAt", ref.importedAt != null ? ref.importedAt : 0L,
                    "isVisible", ref.isVisible
            ));
        }

        return users;
    }

    /**
     * 移除特定用户的分享访问权限
     *
     * @param shareId 分享记录ID
     * @param userId  要移除的用户ID
     * @param ownerId 所有者ID
     */
    @Transactional
    public void removeShareUser(String shareId, String userId, String ownerId) {
        // 1. 查询分享记录
        BundleShare share = bundleShareMapper.selectOneById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("分享记录不存在");
        }

        // 2. 验证所有者权限
        if (!share.ownerId.equals(ownerId)) {
            throw new IllegalArgumentException("无权限管理该分享");
        }

        // 3. 查询该用户通过此分享导入的引用记录
        java.util.List<UserBundleReference> references = referenceMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(USER_BUNDLE_REFERENCE.USER_ID.eq(userId))
                        .and(USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(share.bundleId))
                        .and(USER_BUNDLE_REFERENCE.SHARE_ID.eq(shareId))
                        .and(USER_BUNDLE_REFERENCE.REFERENCE_TYPE.eq("IMPORTED"))
        );

        if (references.isEmpty()) {
            throw new IllegalArgumentException("该用户未通过此分享导入站点");
        }

        // 4. 将引用记录设置为不可见
        for (UserBundleReference ref : references) {
            ref.isVisible = false;
            referenceMapper.update(ref);
        }

        // 5. 更新分享使用统计（减少使用次数）
        if (share.usedCount > 0) {
            share.usedCount--;
            bundleShareMapper.update(share);
        }
    }

    /**
     * 删除分享记录（彻底删除）
     *
     * @param shareId 分享记录ID
     * @param ownerId 所有者ID
     */
    @Transactional
    public void deleteShare(String shareId, String ownerId) {
        // 1. 查询分享记录
        BundleShare share = bundleShareMapper.selectOneById(shareId);
        if (share == null) {
            throw new IllegalArgumentException("分享记录不存在");
        }

        // 2. 验证所有者权限
        if (!share.ownerId.equals(ownerId)) {
            throw new IllegalArgumentException("无权限删除该分享");
        }

        // 3. 删除所有通过该分享导入的引用记录（可选：也可以只设置为不可见）
        java.util.List<UserBundleReference> references = referenceMapper.selectListByQuery(
                com.mybatisflex.core.query.QueryWrapper.create()
                        .where(USER_BUNDLE_REFERENCE.BUNDLE_ID.eq(share.bundleId))
                        .and(USER_BUNDLE_REFERENCE.REFERENCE_TYPE.eq("IMPORTED"))
                        .and(USER_BUNDLE_REFERENCE.SHARE_ID.eq(shareId))
        );

        for (UserBundleReference ref : references) {
            ref.isVisible = false;
            referenceMapper.update(ref);
        }

        // 4. 彻底删除分享记录
        bundleShareMapper.deleteById(shareId);
    }

    /**
     * 生成分享令牌
     */
    private String generateShareToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
