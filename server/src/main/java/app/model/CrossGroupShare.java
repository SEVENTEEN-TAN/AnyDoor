// 跨组分享实体类
// 记录 Bundle 跨组分享关系

package app.model;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.Table;

@Table("cross_group_share")
public class CrossGroupShare {
    @Id
    @Column("id")
    public String id;

    @Column("bundle_id")
    public String bundleId;

    @Column("target_group_id")
    public String targetGroupId;

    @Column("shared_by")
    public String sharedBy;

    @Column("shared_at")
    public long sharedAt;
}
