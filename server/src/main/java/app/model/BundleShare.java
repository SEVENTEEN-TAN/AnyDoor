// Bundle 分享记录实体类（v3.1 新增）
// 记录站点的分享链接和使用情况
// 状态：ACTIVE（活跃）/ REVOKED（已撤销）/ DELETED（已删除）

package app.model;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.Table;

@Table("bundle_share")
public class BundleShare {
    @Id
    @Column("id")
    public String id;

    @Column("bundle_id")
    public String bundleId;

    @Column("owner_id")
    public String ownerId;

    @Column("share_token")
    public String shareToken;  // 分享令牌（用于分享链接）

    @Column("status")
    public String status;  // ACTIVE / REVOKED / DELETED

    @Column("used_count")
    public Integer usedCount;  // 使用次数

    @Column("created_at")
    public Long createdAt;

    @Column("last_used_at")
    public Long lastUsedAt;

    @Column("revoked_at")
    public Long revokedAt;
}
