// 用户组实体类
// 组主账号可以管理组内成员

package app.model;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.Table;

@Table("user_group")
public class UserGroup {
    @Id
    @Column("id")
    public String id;

    @Column("group_name")
    public String groupName;

    @Column("owner_id")
    public String ownerId;

    @Column("description")
    public String description;

    @Column("status")
    public String status;  // ACTIVE / DISABLED

    @Column("max_members")
    public Integer maxMembers;

    @Column("created_at")
    public long createdAt;

    @Column("updated_at")
    public long updatedAt;
}
