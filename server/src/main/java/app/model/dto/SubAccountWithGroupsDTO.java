package app.model.dto;

import java.util.List;

/**
 * 子账号信息DTO（包含所属组信息）
 */
public class SubAccountWithGroupsDTO {
    public String userId;
    public String username;
    public String email;
    public String status;
    public Long createdAt;
    public List<String> groupNames;

    public SubAccountWithGroupsDTO() {
    }

    public SubAccountWithGroupsDTO(String userId, String username, String email,
                                   String status, Long createdAt, List<String> groupNames) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.status = status;
        this.createdAt = createdAt;
        this.groupNames = groupNames;
    }
}
