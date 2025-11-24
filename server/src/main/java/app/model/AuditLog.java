// 审计日志实体类
// 记录所有关键操作

package app.model;

import com.mybatisflex.annotation.Column;
import com.mybatisflex.annotation.Id;
import com.mybatisflex.annotation.Table;

@Table("audit_log")
public class AuditLog {
    @Id
    @Column("id")
    public String id;

    @Column("user_id")
    public String userId;

    @Column("action")
    public String action;  // UPLOAD / WRITEBACK / LOGIN / CREATE_GROUP / IMPORT / etc.

    @Column("resource_type")
    public String resourceType;  // BUNDLE / GROUP / USER

    @Column("resource_id")
    public String resourceId;

    @Column("ip_address")
    public String ipAddress;

    @Column("user_agent")
    public String userAgent;

    @Column("result")
    public String result;  // SUCCESS / FAILURE

    @Column("error_message")
    public String errorMessage;

    @Column("created_at")
    public long createdAt;
}
