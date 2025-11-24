# AnyDoor 项目概览

## 1. 简介
AnyDoor 是一个强大的 Cookie 和会话管理系统，旨在促进不同环境和用户之间浏览器会话的无缝共享和恢复。它由用于捕获和应用 Cookie 的浏览器扩展（插件）以及用于存储、管理和权限控制的后端服务器组成。

## 2. 系统架构
本系统采用客户端-服务器架构：

-   **客户端 (扩展)**：一个 Chrome 扩展（Manifest V3），与浏览器交互以读取和写入 Cookie。它与后端 API 通信以上传和下载会话包（Bundle）。
-   **服务器 (后端)**：一个 Java Spring Boot 应用程序，提供用于用户认证、Bundle 管理、群组协作和权限执行的 RESTful API。
-   **数据库**：MySQL 数据库存储用户数据、群组信息、Bundle 元数据和加密的会话负载。

## 3. 主要功能
-   **会话捕获**：捕获当前标签页的 Cookie 和 LocalStorage。
-   **云端存储**：在服务器上安全地存储会话包。
-   **共享与协作**：
    -   **私有**：仅所有者可见。
    -   **群组**：与特定用户组共享。
    -   **公开**：任何人可见（如果启用）。
    -   **分享链接**：生成用于临时共享的唯一链接。
-   **权限管理**：基于角色的访问控制 (RBAC)，包含 `GLOBAL_ADMIN`（全局管理员）、`GROUP_OWNER`（群组所有者）和 `NORMAL_USER`（普通用户）等角色。
-   **子账号**：支持主账号创建和管理子账号。

## 4. 技术栈
-   **前端**：HTML, JavaScript, Chrome Extension API (Manifest V3)。
-   **后端**：Java 17+, Spring Boot 3.x。
-   **ORM**：MyBatis-Flex。
-   **安全**：Sa-Token (认证), BCrypt (密码哈希)。
-   **数据库**：MySQL 8.0。

## 5. 项目结构
-   `extension/`: 浏览器扩展的源代码。
-   `server/`: 后端服务器的源代码。
