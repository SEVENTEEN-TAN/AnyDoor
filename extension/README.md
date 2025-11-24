# AnyDoor 插件 (扩展) 指南

## 1. 概览
AnyDoor 浏览器扩展是客户端组件，使用户能够捕获和恢复浏览器会话。它是使用 WebExtensions API (Manifest V3) 构建的。

## 2. 安装
1.  打开 Chrome 并导航至 `chrome://extensions/`。
2.  启用右上角的 "开发者模式" (Developer mode)。
3.  点击 "加载已解压的扩展程序" (Load unpacked)，然后选择项目根目录下的 `extension` 目录。

## 3. 架构
-   **Manifest (`manifest.json`)**: 定义权限 (`cookies`, `storage`, `tabs`, `scripting`) 和入口点。
-   **后台服务 Worker (`src/background/service_worker.js`)**: 处理后台任务、上下文菜单事件和持久化状态。
-   **弹出窗口 (`src/popup/popup.html` & `popup.js`)**: 主要的用户界面，用于登录、查看 Bundle 和触发操作。
-   **内容脚本 (Content Scripts)**: (如适用) 注入网页的脚本，用于与 DOM 或 LocalStorage 交互。

## 4. 主要功能
-   **登录/登出**：与 AnyDoor 服务器进行认证。
-   **上传 Bundle**：捕获当前标签页的 Cookie 并上传到服务器。
    -   支持设置过期时间、描述和共享模式。
-   **下载并应用**：从服务器获取 Bundle 并将 Cookie 应用到浏览器。
-   **切换配置**：在不同的用户配置/会话之间快速切换。

## 5. 配置
扩展连接到后端服务器。默认 API 端点在 `src/config.js`（或类似的配置文件）中配置。
-   默认本地环境：`http://localhost:8080`
-   生产环境：(可配置)

## 6. 开发
-   **调试**：使用 `chrome://extensions/` 中的 "Inspect views: service worker" 链接来调试后台脚本。右键点击弹出窗口并选择 "检查" (Inspect) 来调试 UI。
-   **权限**：扩展需要广泛的主机权限 (`<all_urls>`) 才能管理任何域名的 Cookie。
