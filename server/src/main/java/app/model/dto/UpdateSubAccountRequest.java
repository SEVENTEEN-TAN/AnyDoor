package app.model.dto;

/**
 * 更新子账号请求
 */
public record UpdateSubAccountRequest(
        String password,
        String groupId
) {
}
