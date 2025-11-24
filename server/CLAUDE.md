# Server 模块 - 后端服务

[根目录](../CLAUDE.md) > **server**

---

## 变更记录 (Changelog)

### 2025-11-13 13:02:14
- 初始化模块文档

---

## 模块职责

后端服务是 AnyDoor 的核心组件，负责：

1. **用户鉴权**：基于 Sa-Token 的登录/登出/会话管理
2. **Bundle 存储**：接收前端上传的 Cookie+Storage 数据，生成 bundleId
3. **Bundle 回写**：根据 bundleId 返回对应的数据，并验证所有权
4. **黑名单管理**：下发 Cookie 黑名单规则，供前端过滤敏感数据
5. **数据加密**：对存储的 payload 进行加密/解密（MVP 为透传，预留接口）
6. **数据持久化**：使用 MySQL 存储 Bundle 数据

---

## 入口与启动

### 应用入口

**文件：** `src/main/java/app/Application.java`

```java
@SpringBootApplication
@MapperScan("app.mapper")
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

**启动方式：**
- IDE 运行：直接运行 `main` 方法
- Maven 命令：`mvn spring-boot:run`
- 打包运行：`mvn clean package && java -jar target/token-share-mvp-0.0.1-SNAPSHOT.jar`

**默认端口：** 8080

### 配置文件

**文件：** `src/main/resources/application.yml`

**关键配置：**
```yaml
server:
  port: 8080

sa-token:
  token-name: satoken
  timeout: 604800    # 7天（秒）
  is-concurrent: true
  is-share: true
  token-style: uuid

spring:
  datasource:
    druid:
      url: jdbc:mysql://host:port/AnyDoor?useSSL=false&serverTimezone=UTC
      username: your_user
      password: your_password
      driver-class-name: com.mysql.cj.jdbc.Driver
      initial-size: 3
      max-active: 20
      min-idle: 3
```

**环境变量覆盖：**
- `DB_URL`: 数据库连接 URL
- `DB_USER`: 数据库用户名
- `DB_PASS`: 数据库密码

---

## 对外接口

### API 列表

#### 鉴权 API

**1. 登录**

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "testpass"
}
```

**响应：**
```json
{
  "token": "uuid-token-string"
}
```

**说明：**
- MVP 版本任意非空用户名密码即可登录
- token 同时写入 Cookie（名称为 `satoken`）
- 生产环境需接入真实的用户认证系统

---

**2. 获取当前用户信息**

```http
GET /api/auth/me
Headers:
  satoken: your-token-string
```

**响应：**
```json
{
  "userId": "testuser"
}
```

**错误响应（未登录）：**
```json
{
  "error": "not_login"
}
```
HTTP Status: 401

---

**3. 登出**

```http
POST /api/auth/logout
Headers:
  satoken: your-token-string
```

**响应：**
```json
{
  "ok": true
}
```

---

#### Bundle API

**4. 上传 Bundle**

```http
POST /api/bundle/upload
Headers:
  satoken: your-token-string
Content-Type: application/json

{
  "host": "example.com",
  "etld1": "example.com",
  "cookies": [
    {
      "name": "session",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "sameSite": "lax",
      "expirationDate": 1735689600
    }
  ],
  "storage": {
    "localStorage": [
      {"key": "token", "value": "xyz789"}
    ],
    "sessionStorage": []
  }
}
```

**响应：**
```json
{
  "bundleId": "uuid-bundle-id",
  "expireAt": 1735689600000
}
```

**说明：**
- 自动关联当前登录用户（owner）
- bundleId 为 UUID
- expireAt 为当前时间 + 7 天（毫秒时间戳）

---

**5. 回写 Bundle**

```http
POST /api/bundle/writeback
Headers:
  satoken: your-token-string
Content-Type: application/json

{
  "bundleId": "uuid-bundle-id"
}
```

**响应：**
```json
{
  "host": "example.com",
  "etld1": "example.com",
  "cookies": [...],
  "storage": {...}
}
```

**错误响应：**
- 404：bundleId 不存在或已过期
- 403：bundleId 属于其他用户

---

#### 黑名单 API

**6. 获取黑名单**

```http
GET /api/blacklist
```

**响应：**
```json
{
  "version": 1,
  "patterns": [
    {
      "pattern": "(^|\\.)example\\.com\\|session",
      "enabled": true
    },
    {
      "pattern": "(^|\\.)sso\\.corp\\.com\\|token",
      "enabled": true
    }
  ]
}
```

**说明：**
- 无需鉴权
- pattern 为正则表达式，格式为 `domain|name`
- 前端使用此正则匹配并过滤 Cookie

---

## 核心组件

### 架构分层

```
┌─────────────────────────────────┐
│  Controller 层                  │  ← 接收 HTTP 请求，参数校验
│  - AuthController               │
│  - BundleController             │
│  - BlacklistController          │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  Service 层                     │  ← 业务逻辑处理
│  - BundleService                │
│  - CryptoService                │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  Mapper 层                      │  ← 数据访问（MyBatis-Flex）
│  - CookieBundleMapper           │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│  Model 层                       │  ← 数据模型
│  - CookieBundle                 │
└─────────────────────────────────┘
```

---

## 关键依赖与配置

### Maven 依赖

**核心框架：**
- Spring Boot 3.3.2（`spring-boot-starter-web`）
- JDK 17+

**鉴权与安全：**
- Sa-Token 1.38.0（`sa-token-spring-boot3-starter`）

**数据持久化：**
- MyBatis-Flex 1.10.9（`mybatis-flex-spring-boot3-starter`）
- MySQL Connector 8.3.0（`mysql-connector-j`）
- Druid 1.2.23（`druid-spring-boot-3-starter`）

**JSON 处理：**
- Jackson（`jackson-databind`，Spring Boot 内置）

### 配置类

**1. SecurityConfig**

**文件：** `src/main/java/app/config/SecurityConfig.java`

**职责：**
- 配置 CORS 跨域策略
- 开发环境允许所有来源（生产需收敛）

```java
@Bean
public CorsFilter corsFilter() {
    CorsConfiguration config = new CorsConfiguration();
    config.addAllowedOriginPattern("*");
    config.addAllowedHeader("*");
    config.addAllowedMethod("*");
    config.setAllowCredentials(true);
    // ...
}
```

**2. GlobalExceptionHandler**

**文件：** `src/main/java/app/config/GlobalExceptionHandler.java`

**职责：**
- 全局异常捕获
- 统一错误响应格式

**3. BootLogConfig**

**文件：** `src/main/java/app/config/BootLogConfig.java`

**职责：**
- 启动日志配置
- 自定义 Banner

---

## 数据模型

### CookieBundle

**文件：** `src/main/java/app/model/CookieBundle.java`

```java
@Table("cookie_bundle")
public class CookieBundle {
    @Id
    public String id;           // UUID，主键

    public String owner;         // 用户 ID（关联登录用户）

    public String host;          // 站点 hostname

    public String etld1;         // eTLD+1

    public String payload;       // JSON 字符串（加密后的数据）

    public long expireAt;        // 过期时间戳（毫秒）

    public long createdAt;       // 创建时间戳（毫秒）
}
```

### 数据库表结构

**文件：** `src/main/resources/schema.sql`

```sql
CREATE TABLE IF NOT EXISTS `cookie_bundle` (
  `id` varchar(64) NOT NULL,
  `owner` varchar(128) NOT NULL,
  `host` varchar(255) NOT NULL,
  `etld1` varchar(255) NOT NULL,
  `payload` mediumtext NOT NULL,
  `expire_at` bigint NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bundle_owner` (`owner`),
  KEY `idx_bundle_expire` (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**索引说明：**
- `PRIMARY KEY (id)`: bundleId 唯一索引
- `idx_bundle_owner`: 按用户查询优化
- `idx_bundle_expire`: 过期数据清理优化

---

## 业务逻辑详解

### BundleService

**文件：** `src/main/java/app/service/BundleService.java`

**核心方法：**

#### 1. save()

```java
public CookieBundle save(String owner, String host, String etld1, String jsonPayload)
```

**职责：**
- 生成 UUID 作为 bundleId
- 设置 owner（当前登录用户）
- 计算 expireAt（当前时间 + 7 天）
- 调用 CryptoService 加密 payload
- 持久化到数据库

**流程：**
```
1. 生成 UUID
2. 设置基础字段（owner, host, etld1）
3. 计算时间戳
4. 加密 payload
5. 插入数据库
6. 返回 CookieBundle 对象
```

#### 2. get()

```java
public Optional<CookieBundle> get(String id)
```

**职责：**
- 根据 bundleId 查询数据库
- 检查是否过期
- 返回 Optional<CookieBundle>

**流程：**
```
1. 查询数据库
2. 检查记录是否存在
3. 检查是否过期（expireAt < now）
4. 返回结果
```

---

### CryptoService

**文件：** `src/main/java/app/service/CryptoService.java`

**当前实现：**
```java
public String encrypt(String json) { return json; }   // MVP 透传
public String decrypt(String payload) { return payload; }
```

**预留接口：**
- 生产环境需接入 SM4-GCM 加密
- 支持 keyId 轮转
- 集成 KMS（密钥管理服务）

**实现建议：**
```java
public String encrypt(String json) {
    // 1. 获取当前 keyId
    // 2. 从 KMS 获取对应密钥
    // 3. 使用 SM4-GCM 加密
    // 4. 返回 "keyId:ciphertext" 格式
}

public String decrypt(String payload) {
    // 1. 解析 keyId
    // 2. 从 KMS 获取对应密钥
    // 3. 使用 SM4-GCM 解密
    // 4. 返回明文
}
```

---

## 测试与质量

### 当前状态
- 无自动化测试
- 依赖手工接口测试

### 测试建议

**单元测试：**
```java
// BundleService 测试
@Test
void testSave() {
    // 测试 Bundle 保存逻辑
}

@Test
void testGetExpired() {
    // 测试过期 Bundle 不可访问
}

@Test
void testGetNotFound() {
    // 测试不存在的 bundleId
}
```

**集成测试：**
```java
// Controller 测试
@Test
@WithMockUser
void testUpload() {
    // 测试上传接口
}

@Test
void testWritebackUnauthorized() {
    // 测试未登录访问
}

@Test
@WithMockUser
void testWritebackForbidden() {
    // 测试访问他人的 bundleId
}
```

**API 契约测试：**
- 使用 Postman/Insomnia 导出测试集
- 集成到 CI/CD 流程

---

## 常见问题 (FAQ)

### Q1: 如何修改 Token 过期时间？

编辑 `application.yml`：
```yaml
sa-token:
  timeout: 604800    # 秒（7 天）
```

重启服务生效。

### Q2: 如何启用真实的用户认证？

修改 `AuthController#login` 方法：
```java
@PostMapping("/login")
public ResponseEntity<?> login(@RequestBody LoginReq req) {
    // 1. 调用用户服务验证用户名密码
    User user = userService.authenticate(req.username(), req.password());
    if (user == null) {
        return ResponseEntity.status(401).body(Map.of("error", "invalid_credentials"));
    }

    // 2. 使用真实的 userId 登录
    StpUtil.login(user.getId());

    // 3. 返回 token
    String token = StpUtil.getTokenValue();
    return ResponseEntity.ok(Map.of("token", token));
}
```

### Q3: 如何清理过期数据？

**方式1：定时任务**
```java
@Scheduled(cron = "0 0 2 * * ?")  // 每天凌晨 2 点
public void cleanExpiredBundles() {
    long now = System.currentTimeMillis();
    // 删除过期记录
    mapper.deleteByQuery(
        QueryWrapper.create()
            .where(COOKIE_BUNDLE.EXPIRE_AT.lt(now))
    );
}
```

**方式2：数据库事件**
```sql
-- 创建定时清理事件
CREATE EVENT clean_expired_bundles
ON SCHEDULE EVERY 1 DAY
DO
DELETE FROM cookie_bundle WHERE expire_at < UNIX_TIMESTAMP() * 1000;
```

### Q4: 如何接入动态黑名单？

修改 `BlacklistController`：
```java
@RestController
@RequestMapping("/api/blacklist")
public class BlacklistController {
    private final BlacklistService blacklistService;

    @GetMapping
    public ResponseEntity<?> getList() {
        // 从数据库或配置中心读取
        List<BlacklistPattern> patterns = blacklistService.getEnabledPatterns();
        return ResponseEntity.ok(Map.of(
            "version", blacklistService.getVersion(),
            "patterns", patterns
        ));
    }

    @PostMapping
    @SaCheckRole("admin")
    public ResponseEntity<?> addPattern(@RequestBody BlacklistPattern pattern) {
        blacklistService.addPattern(pattern);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
```

### Q5: 如何限制单个用户的 Bundle 数量？

在 `BundleService#save` 中添加检查：
```java
public CookieBundle save(String owner, String host, String etld1, String jsonPayload) {
    // 检查用户现有 Bundle 数量
    long count = mapper.selectCountByQuery(
        QueryWrapper.create()
            .where(COOKIE_BUNDLE.OWNER.eq(owner))
            .and(COOKIE_BUNDLE.EXPIRE_AT.gt(System.currentTimeMillis()))
    );

    if (count >= MAX_BUNDLES_PER_USER) {
        throw new BusinessException("超出 Bundle 数量限制");
    }

    // 正常保存逻辑...
}
```

---

## 相关文件清单

### 应用入口
- `src/main/java/app/Application.java` - Spring Boot 启动类

### 控制器层
- `src/main/java/app/controller/AuthController.java` - 鉴权接口
- `src/main/java/app/controller/BundleController.java` - Bundle CRUD 接口
- `src/main/java/app/controller/BlacklistController.java` - 黑名单查询接口

### 服务层
- `src/main/java/app/service/BundleService.java` - Bundle 业务逻辑
- `src/main/java/app/service/CryptoService.java` - 加密/解密服务（预留）

### 数据访问层
- `src/main/java/app/mapper/CookieBundleMapper.java` - MyBatis-Flex Mapper
- `src/main/java/app/repo/BundleRepository.java` - 仓库接口（备用）

### 数据模型
- `src/main/java/app/model/CookieBundle.java` - Bundle 实体类

### 配置类
- `src/main/java/app/config/SecurityConfig.java` - CORS 配置
- `src/main/java/app/config/GlobalExceptionHandler.java` - 全局异常处理
- `src/main/java/app/config/BootLogConfig.java` - 启动日志配置

### 资源文件
- `src/main/resources/application.yml` - 应用配置
- `src/main/resources/schema.sql` - 数据库建表脚本

### 构建配置
- `pom.xml` - Maven 依赖管理

---

## 安全注意事项

### 鉴权机制

**Sa-Token 配置：**
- token-name: `satoken`（请求头或 Cookie）
- timeout: 7 天
- 支持并发登录（is-concurrent: true）

**鉴权注解：**
```java
@SaCheckLogin         // 必须登录
@SaCheckRole("admin") // 必须有 admin 角色
@SaCheckPermission("bundle:write") // 必须有特定权限
```

### 所有权验证

在 `BundleController#writeback` 中：
```java
String owner = String.valueOf(StpUtil.getLoginId());
if (!owner.equals(b.owner)) {
    return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
}
```

确保用户只能访问自己的 Bundle。

### CORS 策略

**开发环境：**
```java
config.addAllowedOriginPattern("*");  // 允许所有来源
```

**生产环境建议：**
```java
config.addAllowedOrigin("https://your-extension-origin");
config.setAllowCredentials(true);
```

### SQL 注入防护

使用 MyBatis-Flex 的参数化查询：
```java
// 安全
mapper.selectOneById(id);

// 不安全（避免使用）
mapper.selectBySql("SELECT * FROM cookie_bundle WHERE id = '" + id + "'");
```

### 加密建议

**当前状态：**
- payload 明文存储（MVP）

**生产要求：**
- 接入 SM4-GCM 加密算法
- 密钥从 KMS 获取，不硬编码
- 支持 keyId 轮转
- 加密字段：payload（包含 Cookie 和 Storage）

---

## 下一步优化

### 功能增强
- [ ] 实现真实的用户认证系统
- [ ] 支持 Bundle 列表查询（分页）
- [ ] 支持 Bundle 删除/续期
- [ ] 实现动态黑名单管理接口
- [ ] 增加操作审计日志

### 性能优化
- [ ] 添加 Redis 缓存层
- [ ] 实现 Bundle 热点数据预加载
- [ ] 优化数据库索引
- [ ] 添加连接池监控

### 安全加固
- [ ] 接入真实加密服务（SM4-GCM + KMS）
- [ ] 实现 API 限流（防刷）
- [ ] 添加 IP 白名单
- [ ] 实现 bundleId 一次性使用机制
- [ ] 增加设备指纹验证

### 监控与运维
- [ ] 集成 Prometheus + Grafana
- [ ] 添加健康检查接口
- [ ] 实现 Graceful Shutdown
- [ ] 添加慢查询日志
- [ ] 实现数据库备份与恢复策略

### 测试完善
- [ ] 编写单元测试（目标覆盖率 > 80%）
- [ ] 编写集成测试
- [ ] 添加性能测试
- [ ] 集成到 CI/CD 流程
