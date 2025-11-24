# Extension 模块 - 浏览器扩展

[根目录](../CLAUDE.md) > **extension**

---

## 变更记录 (Changelog)

### 2025-11-13 13:02:14
- 初始化模块文档

---

## 模块职责

浏览器扩展是 AnyDoor 的客户端组件，负责：

1. **Cookie 采集**：从当前标签页所在域名采集所有 Cookie
2. **本地缓存采集**：快照 localStorage 和 sessionStorage
3. **黑名单过滤**：根据服务端下发的黑名单规则过滤敏感 Cookie
4. **数据上传**：将采集的数据打包上传至后端，获取 bundleId
5. **数据回写**：根据 bundleId 从后端拉取数据，清空当前站点缓存后写入
6. **用户交互**：提供 Popup 和 Options 页面供用户操作

---

## 入口与启动

### Manifest 配置

**文件：** `manifest.json`

**关键配置：**
```json
{
  "manifest_version": 3,
  "name": "Token Share MVP",
  "version": "0.1.0",
  "permissions": ["cookies", "storage", "tabs", "scripting"],
  "host_permissions": ["http://localhost:8080/*", "<all_urls>"],
  "background": {
    "service_worker": "src/background/service_worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/popup.html"
  },
  "options_page": "src/options/options.html"
}
```

**权限说明：**
- `cookies`: 读取和写入 Cookie
- `storage`: 使用 chrome.storage.sync 保存配置
- `tabs`: 查询当前活动标签页
- `scripting`: 注入脚本操作 localStorage/sessionStorage
- `host_permissions`: 访问所有网站的 Cookie + 后端 API

### 启动流程

```
用户点击扩展图标
    ↓
打开 popup.html
    ↓
popup.js 初始化
    ↓
调用 lib/api.js#me() 检查登录状态
    ↓
显示"已登录"或"未登录"提示
```

---

## 对外接口

### 用户界面

#### Popup（弹窗界面）

**文件：** `src/popup/popup.html`, `src/popup/popup.js`

**功能：**
- 上传按钮：采集当前站点 Cookie 并上传
- 回写输入框 + 回写按钮：输入 bundleId 并回写数据
- 设置按钮：跳转到 Options 页面

**交互流程：**
```javascript
// 上传
用户点击"上传"
  → 发送消息给 service_worker: {type:"upload"}
  → 返回 {ok:true, bundleId, expireAt, count}
  → 显示 bundleId 供用户复制

// 回写
用户输入 bundleId 点击"回写"
  → 弹出确认对话框（警告会清空缓存）
  → 发送消息给 service_worker: {type:"writeback", bundleId}
  → 返回 {ok:true, count}
  → 自动刷新页面
```

#### Options（设置页面）

**文件：** `src/options/options.html`, `src/options/options.js`

**功能：**
- BaseURL 配置：设置后端 API 地址（默认 http://localhost:8080）
- 登录：输入用户名密码，调用后端登录接口
- 退出登录：清除本地 token

**存储：**
- 使用 `chrome.storage.sync` 保存 `{baseUrl, token}`
- 跨设备同步配置

---

## 核心接口与 API

### Background Service Worker

**文件：** `src/background/service_worker.js`

**消息监听器：**

```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "upload") {
    // 1. 获取当前标签页 URL
    // 2. 采集 Cookie（按 host 和 etld1 过滤）
    // 3. 获取黑名单并过滤
    // 4. 快照 localStorage/sessionStorage
    // 5. 上传至后端
    // 6. 返回 bundleId
  }

  if (msg?.type === "writeback") {
    // 1. 从后端拉取 bundleId 对应的数据
    // 2. 清空当前站点 Cookie
    // 3. 清空本地缓存（localStorage/sessionStorage/IndexedDB/Cache/ServiceWorker）
    // 4. 分组写入 Cookie（按域名分组，自动选择 https/http）
    // 5. 写入 localStorage/sessionStorage
    // 6. 自动刷新页面
  }
});
```

---

## 关键依赖与配置

### 内部依赖

| 模块 | 路径 | 职责 |
|------|------|------|
| API 封装 | `src/lib/api.js` | 统一封装后端 API 调用，处理 token 注入与错误 |
| Cookie 工具 | `src/lib/cookies.js` | Cookie 采集、写入、清空逻辑 |
| Storage 工具 | `src/lib/storage.js` | localStorage/sessionStorage 快照与清空 |
| 黑名单工具 | `src/lib/blacklist.js` | 根据正则规则过滤 Cookie |
| eTLD+1 工具 | `src/lib/etld1.js` | 计算域名的有效顶级域名+1 |

### 外部依赖

**Chrome Extension APIs：**
- `chrome.cookies`: Cookie 读写
- `chrome.storage.sync`: 配置存储
- `chrome.tabs`: 标签页操作
- `chrome.scripting`: 脚本注入
- `chrome.runtime`: 消息通信

**后端 API：**
- `POST /api/auth/login`: 登录
- `GET /api/auth/me`: 获取当前用户信息
- `POST /api/auth/logout`: 登出
- `GET /api/blacklist`: 获取黑名单
- `POST /api/bundle/upload`: 上传 Cookie Bundle
- `POST /api/bundle/writeback`: 回写 Cookie Bundle

---

## 数据模型

### Cookie 对象

```javascript
{
  name: string,           // Cookie 名称
  value: string,          // Cookie 值
  domain: string,         // 域名（可能带前缀点）
  path: string,           // 路径
  secure: boolean,        // 是否仅 HTTPS
  httpOnly: boolean,      // 是否仅 HTTP（JS 不可访问）
  sameSite: string,       // "strict" | "lax" | "no_restriction" | "unspecified"
  expirationDate: number, // 过期时间戳（秒）
  hostOnly: boolean,      // 是否为 hostOnly Cookie（如 __Host- 前缀）
  partitionKey: object,   // 分区键（可选）
  storeId: string         // Cookie Store ID（可选）
}
```

### Storage 快照

```javascript
{
  localStorage: [
    { key: string, value: string },
    ...
  ],
  sessionStorage: [
    { key: string, value: string },
    ...
  ]
}
```

### Bundle Payload（上传格式）

```javascript
{
  host: string,           // 当前站点 hostname
  etld1: string,          // eTLD+1
  cookies: Cookie[],      // Cookie 数组
  storage: Storage        // localStorage/sessionStorage 快照
}
```

---

## 测试与质量

### 当前状态
- 无自动化测试
- 依赖浏览器手工测试

### 测试检查点

**Cookie 采集：**
- [ ] 正确采集 host 下的所有 Cookie
- [ ] 正确采集 eTLD+1 域下的 Cookie（包括子域）
- [ ] hostOnly Cookie 不带 domain 字段
- [ ] secure Cookie 标记正确
- [ ] sameSite 属性转换正确

**Cookie 写入：**
- [ ] 写入前清空旧 Cookie
- [ ] hostOnly Cookie 不设置 domain 字段
- [ ] secure Cookie 使用 https URL
- [ ] domain Cookie 正确设置 domain
- [ ] 写入失败时尝试多种变体（partitionKey/storeId/domain）

**本地缓存：**
- [ ] localStorage 正确快照
- [ ] sessionStorage 正确快照
- [ ] 回写前清空 IndexedDB
- [ ] 回写前清空 Cache Storage
- [ ] 回写前注销 Service Worker

**黑名单：**
- [ ] 正则匹配正确（domain|name 格式）
- [ ] 过滤后的 Cookie 不包含黑名单项
- [ ] 黑名单服务端同步正常

**错误处理：**
- [ ] 未登录时提示跳转设置
- [ ] API 调用失败时显示友好错误
- [ ] Cookie 写入失败时显示详细错误
- [ ] 回写前确认对话框

---

## 常见问题 (FAQ)

### Q1: 为什么回写后部分 Cookie 写入失败？

**原因：**
- hostOnly Cookie（如 `__Host-` 前缀）不能设置 domain 字段
- secure Cookie 必须使用 https URL
- 某些站点的 Cookie 带有 partitionKey 或 storeId

**解决方案：**
- 代码中已实现多变体重试机制（见 `cookies.js#writeCookies`）
- 尝试不同的 domain/partitionKey/storeId 组合
- 查看控制台日志获取详细失败原因

### Q2: 为什么 localStorage 快照为空？

**原因：**
- 站点可能使用了 iframe 或跨域 localStorage
- 站点禁用了 storage API
- 脚本注入权限不足

**解决方案：**
- 检查 manifest.json 的 `host_permissions` 是否包含目标域名
- 查看控制台是否有权限错误
- 确认站点没有 CSP（Content Security Policy）阻止脚本注入

### Q3: 为什么回写后页面还是未登录状态？

**原因：**
- Cookie 的 domain/path 不匹配
- 站点使用了额外的 token 验证机制（如 JWT 存储在 sessionStorage）
- Cookie 的 sameSite 属性导致浏览器拒绝
- 站点需要额外的 CSRF token

**解决方案：**
- 检查上传时采集的 Cookie 是否完整
- 确认 sessionStorage 是否也被快照和回写
- 查看浏览器开发者工具的 Application → Cookies 面板，确认 Cookie 已写入
- 某些站点可能需要手动刷新或重新触发登录流程

### Q4: 如何调试 Service Worker？

1. 打开 `chrome://extensions/`
2. 找到 Token Share MVP 扩展卡片
3. 点击"Service Worker"链接
4. 在打开的控制台中查看日志（所有日志都带 `[bg]` 前缀）
5. 设置断点或使用 `console.log` 调试

### Q5: 如何查看 Popup 的日志？

1. 打开扩展 Popup
2. 右键点击 Popup 窗口
3. 选择"检查"或"审查元素"
4. 在打开的开发者工具中查看 Console 面板

---

## 相关文件清单

### 用户界面
- `src/popup/popup.html` - Popup UI 结构
- `src/popup/popup.js` - Popup 交互逻辑
- `src/options/options.html` - Options 页面结构
- `src/options/options.js` - Options 页面逻辑

### 核心逻辑
- `src/background/service_worker.js` - 后台服务，处理 Cookie 采集与回写
- `manifest.json` - 扩展配置与权限声明

### 工具库
- `src/lib/api.js` - 后端 API 封装
- `src/lib/cookies.js` - Cookie 采集、写入、清空工具
- `src/lib/storage.js` - localStorage/sessionStorage 快照与清空
- `src/lib/blacklist.js` - Cookie 黑名单过滤
- `src/lib/etld1.js` - eTLD+1 计算工具

---

## 技术细节

### Cookie 采集策略

1. **两级过滤**：
   - 一级：按 `host` 过滤（精确匹配当前站点）
   - 二级：按 `etld1` 过滤（包含顶级域下的所有 Cookie）

2. **eTLD+1 计算**：
   - MVP 版本采用简化算法：取最后两段域名
   - 例如：`www.example.com` → `example.com`
   - IPv4 地址直接返回
   - 后续可接入 Public Suffix List

### Cookie 写入策略

1. **清空旧 Cookie**：
   - 同时尝试 http 和 https 协议
   - 带上原 storeId/partitionKey（如有）

2. **分组写入**：
   - 按 Cookie 的 domain 分组
   - 每组使用统一的 contextUrl（根据是否有 secure Cookie 决定协议）

3. **变体重试**：
   - Variant 1：基线（不带 storeId/partitionKey）
   - Variant 2：带 partitionKey（如原有）
   - Variant 3：带 storeId（如原有）
   - Variant 4：切换 domain 设置

4. **URL 构造**：
   - secure Cookie：强制使用 https
   - 非 secure Cookie：使用页面当前协议
   - hostOnly Cookie：不设置 domain 字段

### 本地缓存清空

**清空范围：**
- localStorage
- sessionStorage
- IndexedDB（所有数据库）
- Cache Storage（所有缓存）
- Service Worker（所有注册）

**实现方式：**
- 通过 `chrome.scripting.executeScript` 注入脚本到页面上下文
- 使用 `world: "MAIN"` 确保脚本在页面主世界运行
- 异步清空所有存储，忽略单个失败

---

## 安全注意事项

### 权限最小化

- 仅在需要时请求 `<all_urls>` 权限
- 生产环境应限制 `host_permissions` 到可信域名列表

### 黑名单保护

- 服务端下发黑名单规则
- 客户端本地过滤，避免敏感 Cookie 上传
- 默认黑名单包括：
  - `*.example.com|session`
  - `*.sso.corp.com|token`

### 用户确认

- 回写前强制弹出确认对话框
- 明确告知会清空当前站点缓存
- 避免误操作导致数据丢失

### HTTPS 推荐

- 开发环境可使用 HTTP
- 生产环境必须使用 HTTPS
- secure Cookie 强制使用 https URL

---

## 下一步优化

### 功能增强
- [ ] 支持部分回写（仅 Cookie 或仅 Storage）
- [ ] 增加回写前预览功能
- [ ] 支持批量上传/回写多个站点
- [ ] 增加历史 bundleId 管理

### 用户体验
- [ ] 添加加载动画
- [ ] 优化错误提示
- [ ] 增加操作撤销功能
- [ ] 支持快捷键操作

### 技术优化
- [ ] 接入完整的 Public Suffix List
- [ ] 优化 Cookie 写入成功率
- [ ] 增加离线缓存机制
- [ ] 添加单元测试

### 安全加固
- [ ] 实现客户端加密
- [ ] 增加操作审计日志
- [ ] 支持 bundleId 一次性使用
- [ ] 增加设备指纹验证
