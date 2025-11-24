// 用户 Bundle 引用实体类（v3.0 新增）
// 记录用户对 Bundle 的引用关系
// 引用类型：OWNER（创建者）/ IMPORTED（导入者）/ GROUP_SHARED（组内共享）

package app.model;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.Table;

@Table("user_bundle_reference")
public class UserBundleReference {
    @Id
    @Column("id")
    public String id;

    @Column("user_id")
    public String userId;

    @Column("bundle_id")
    public String bundleId;

    @Column("reference_type")
    public String referenceType;  // OWNER / IMPORTED / GROUP_SHARED

    @Column("is_visible")
    public Boolean isVisible;  // 软删除标志

    @Column("imported_at")
    public Long importedAt;

    @Column("imported_from")
    public String importedFrom;  // 导入来源（URL 或链接）

    @Column("share_id")
    public String shareId;  // 分享记录ID（通过哪个分享导入的）
}
