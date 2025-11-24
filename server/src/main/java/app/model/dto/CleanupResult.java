package app.model.dto;

/**
 * 清理结果
 */
public class CleanupResult {
    public int deletedSitesCount;
    public int deletedUsersCount;
    public int deletedGroupsCount;

    public CleanupResult() {
    }

    public CleanupResult(int deletedSitesCount, int deletedUsersCount, int deletedGroupsCount) {
        this.deletedSitesCount = deletedSitesCount;
        this.deletedUsersCount = deletedUsersCount;
        this.deletedGroupsCount = deletedGroupsCount;
    }
}
