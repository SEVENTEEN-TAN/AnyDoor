package app.model.dto;

/**
 * 孤立数据统计
 */
public class OrphanedDataStats {
    public int orphanedSitesCount;
    public int orphanedUsersCount;
    public int orphanedGroupsCount;

    public OrphanedDataStats() {
    }

    public OrphanedDataStats(int orphanedSitesCount, int orphanedUsersCount, int orphanedGroupsCount) {
        this.orphanedSitesCount = orphanedSitesCount;
        this.orphanedUsersCount = orphanedUsersCount;
        this.orphanedGroupsCount = orphanedGroupsCount;
    }
}
