// v3.0: 支持 Bundle 命名和组管理
// 新增字段：name, description, tags, groupId, shareMode
// 支持三种分享模式：GROUP_ONLY, CROSS_GROUP, GLOBAL

package app.model;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.Table;

@Table("cookie_bundle")
public class CookieBundle {
    @Id
    @Column("id")
    public String id;

    @Column("owner_id")
    public String ownerId;

    @Column("group_id")
    public String groupId;

    @Column("share_mode")
    public String shareMode;  // GROUP_ONLY / PRIVATE / PUBLIC

    // v3.0 新增：Bundle 命名
    @Column("name")
    public String name;

    @Column("description")
    public String description;

    @Column("tags")
    public String tags;

    @Column("host")
    public String host;

    @Column("etld1")
    public String etld1;

    @Column("payload")
    public String payload; // JSON string

    @Column("expire_at")
    public long expireAt;

    @Column("created_at")
    public long createdAt;

    @Column("updated_at")
    public Long updatedAt;

    @Column("accessed_at")
    public Long accessedAt;

    @Column("access_count")
    public Integer accessCount;
}
