# AnyDoor 后端指南

## 1. 概览
后端是一个 Spring Boot 应用程序，作为 AnyDoor 的中心枢纽。它处理数据持久化、业务逻辑和 API 端点。

## 2. 设置与运行
### 前置条件
-   JDK 17 或更高版本
-   Maven 3.x
-   MySQL 数据库

### 配置
应用程序配置位于 `src/main/resources/application.yml`。
-   **服务器端口**：默认 `8080`。
-   **数据库**：在 `spring.datasource` 下配置。
-   **Sa-Token**：用于认证的令牌配置。

### 运行
```bash
mvn spring-boot:run
```

## 3. 核心模块

### 3.1 认证 (`AuthController`)
-   **登录/注册**：使用 Sa-Token 进行基于 JWT 的认证。
-   **子账号**：用于在主账号下创建和管理子账号的 API。
-   **权限**：基于角色的检查 (`GLOBAL_ADMIN`, `GROUP_OWNER`, `MEMBER`)。

### 3.2 Bundle 管理 (`BundleService` & `BundleController`)
-   **上传**：接收加密的 Cookie 数据和元数据。
-   **列表**：检索用户可见的 Bundle（私有、群组、公开、已导入）。
    -   *优化*：使用批量查询高效获取已导入的 Bundle。
-   **导入**：允许用户 "导入" Bundle（创建引用）以便轻松访问。
-   **分享**：生成用于外部共享的分享令牌。

### 3.3 群组管理 (`GroupService` & `GroupController`)
-   **创建群组**：用户可以创建群组进行协作。
-   **成员**：添加/移除成员并分配角色。
-   **共享**：Bundle 可以与特定群组共享 (`GROUP_ONLY` 模式)。

## 4. 数据库模式
主要表包括：
-   `user`：用户账号和角色。
-   `cookie_bundle`：存储会话数据（加密负载）和元数据。
-   `user_group`：群组定义。
-   `user_group_relation`：用户和群组之间的多对多关系。
-   `user_bundle_reference`：跟踪哪些用户导入了哪些 Bundle。
-   `bundle_share`：跟踪活动的分享链接。

## 5. API 参考
### 认证 (Auth)
-   `POST /api/auth/login`：用户登录。
-   `POST /api/auth/register`：用户注册。
-   `GET /api/auth/me`：当前用户信息。

### Bundle
-   `POST /api/bundle/upload`：上传新的会话 Bundle。
-   `GET /api/bundle/list`：列出可用 Bundle。
-   `POST /api/bundle/import`：通过 ID 导入 Bundle。
-   `POST /api/bundle/{bundleId}/share`：创建分享链接。

### 群组 (Group)
-   `POST /api/group/create`：创建新群组。
-   `GET /api/group/my`：列出我的群组。
