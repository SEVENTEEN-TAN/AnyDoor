// 用户组关系实体类
// 记录用户与组的关系以及在组内的角色

package app.model;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.Table;

@Table("user_group_relation")
public class UserGroupRelation {
    @Id
    @Column("id")
    public String id;

    @Column("user_id")
    public String userId;

    @Column("group_id")
    public String groupId;

    @Column("role_in_group")
    public String roleInGroup;  // OWNER / ADMIN / MEMBER

    @Column("joined_at")
    public long joinedAt;
}
