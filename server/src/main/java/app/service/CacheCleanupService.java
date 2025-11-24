package app.service;

import app.mapper.CookieBundleMapper;
import app.mapper.UserGroupMapper;
import app.mapper.UserMapper;
import app.model.CookieBundle;
import app.model.User;
import app.model.UserGroup;
import app.model.dto.CleanupResult;
import app.model.dto.OrphanedDataStats;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 缓存清理服务
 * 用于识别和删除系统中的孤立数据
 */
@Service
public class CacheCleanupService {
    private static final Logger log = LoggerFactory.getLogger(CacheCleanupService.class);

    private final CookieBundleMapper cookieBundleMapper;
    private final UserMapper userMapper;
    private final UserGroupMapper userGroupMapper;

    public CacheCleanupService(
            CookieBundleMapper cookieBundleMapper,
            UserMapper userMapper,
            UserGroupMapper userGroupMapper
    ) {
        this.cookieBundleMapper = cookieBundleMapper;
        this.userMapper = userMapper;
        this.userGroupMapper = userGroupMapper;
    }

    /**
     * 查找孤立站点
     *
     * @return 孤立站点ID列表
     */
    public List<String> findOrphanedSites() {
        Set<String> orphanedSiteIds = new HashSet<>();

        // 查找所有者不存在的站点
        List<CookieBundle> allSites = cookieBundleMapper.selectAll();
        List<String> allUserIds = userMapper.selectAll().stream()
                .map(u -> u.id)
                .collect(Collectors.toList());

        for (CookieBundle site : allSites) {
            if (site.ownerId != null && !allUserIds.contains(site.ownerId)) {
                orphanedSiteIds.add(site.id);
            }
        }

        // 查找所属组不存在的站点
        List<String> allGroupIds = userGroupMapper.selectAll().stream()
                .map(g -> g.id)
                .collect(Collectors.toList());

        for (CookieBundle site : allSites) {
            if (site.groupId != null && !allGroupIds.contains(site.groupId)) {
                orphanedSiteIds.add(site.id);
            }
        }

        log.info("Found {} orphaned sites", orphanedSiteIds.size());
        return new ArrayList<>(orphanedSiteIds);
    }

    /**
     * 查找孤立用户
     *
     * @return 孤立用户ID列表
     */
    public List<String> findOrphanedUsers() {
        List<User> allUsers = userMapper.selectAll();
        Set<String> allUserIds = allUsers.stream()
                .map(u -> u.id)
                .collect(Collectors.toSet());

        List<String> orphanedUserIds = allUsers.stream()
                .filter(u -> u.parentUserId != null && !allUserIds.contains(u.parentUserId))
                .map(u -> u.id)
                .collect(Collectors.toList());

        log.info("Found {} orphaned users", orphanedUserIds.size());
        return orphanedUserIds;
    }

    /**
     * 查找孤立组
     *
     * @return 孤立组ID列表
     */
    public List<String> findOrphanedGroups() {
        List<UserGroup> allGroups = userGroupMapper.selectAll();
        List<String> allUserIds = userMapper.selectAll().stream()
                .map(u -> u.id)
                .collect(Collectors.toList());

        List<String> orphanedGroupIds = allGroups.stream()
                .filter(g -> g.ownerId != null && !allUserIds.contains(g.ownerId))
                .map(g -> g.id)
                .collect(Collectors.toList());

        log.info("Found {} orphaned groups", orphanedGroupIds.size());
        return orphanedGroupIds;
    }

    /**
     * 预览孤立数据统计
     *
     * @return 孤立数据统计信息
     */
    public OrphanedDataStats previewOrphanedData() {
        List<String> orphanedSites = findOrphanedSites();
        List<String> orphanedUsers = findOrphanedUsers();
        List<String> orphanedGroups = findOrphanedGroups();

        return new OrphanedDataStats(
                orphanedSites.size(),
                orphanedUsers.size(),
                orphanedGroups.size()
        );
    }

    /**
     * 执行清理操作
     *
     * @param operatorId 操作者ID
     * @return 清理结果统计
     */
    @Transactional
    public CleanupResult executeCleanup(String operatorId) {
        log.info("Starting cache cleanup, operatorId={}", operatorId);

        // 查找孤立数据
        List<String> orphanedSiteIds = findOrphanedSites();
        List<String> orphanedUserIds = findOrphanedUsers();
        List<String> orphanedGroupIds = findOrphanedGroups();

        // 删除孤立站点
        for (String siteId : orphanedSiteIds) {
            cookieBundleMapper.deleteById(siteId);
        }
        log.info("Deleted {} orphaned sites", orphanedSiteIds.size());

        // 删除孤立用户
        for (String userId : orphanedUserIds) {
            userMapper.deleteById(userId);
        }
        log.info("Deleted {} orphaned users", orphanedUserIds.size());

        // 删除孤立组
        for (String groupId : orphanedGroupIds) {
            userGroupMapper.deleteById(groupId);
        }
        log.info("Deleted {} orphaned groups", orphanedGroupIds.size());

        log.info("Cache cleanup completed: operatorId={}, sites={}, users={}, groups={}",
                operatorId, orphanedSiteIds.size(), orphanedUserIds.size(), orphanedGroupIds.size());

        return new CleanupResult(
                orphanedSiteIds.size(),
                orphanedUserIds.size(),
                orphanedGroupIds.size()
        );
    }
}
