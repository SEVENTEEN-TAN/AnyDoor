// 用户实体类
// 角色：GLOBAL_ADMIN, GROUP_OWNER, NORMAL_USER
// 状态：ACTIVE, DISABLED, BANNED

package app.model;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.Table;

@Table("user")
public class User {
    @Id
    @Column("id")
    public String id;

    @Column("username")
    public String username;

    @Column("password_hash")
    public String passwordHash;

    @Column("email")
    public String email;

    @Column("display_name")
    public String displayName;

    @Column("role")
    public String role;  // GLOBAL_ADMIN / GROUP_OWNER / NORMAL_USER

    @Column("status")
    public String status;  // ACTIVE / DISABLED / BANNED

    @Column("parent_user_id")
    public String parentUserId;  // 父账号ID（子账号专用，主账号为NULL）

    @Column("created_at")
    public long createdAt;

    @Column("updated_at")
    public long updatedAt;
}
