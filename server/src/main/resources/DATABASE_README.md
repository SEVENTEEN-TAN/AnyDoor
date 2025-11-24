# AnyDoor 数据库初始化指南

## 📋 文件说明

### schema_full.sql - 完整数据库结构

**包含：** 8个表 + 默认数据

```
├── user                    - 用户表
├── user_group              - 用户组表
├── user_group_relation     - 用户组关系表
├── cookie_bundle           - Bundle存储表 ⭐核心表
├── user_bundle_reference   - Bundle引用表
├── blacklist_pattern       - 黑名单规则表
├── audit_log               - 审计日志表
└── cross_group_share       - 跨组分享表
```

**默认账号：** `admin` / `admin123` ⚠️首次部署后请立即修改

---

## 🚀 快速开始

```bash
# 1. 创建数据库
mysql -u root -p -e "CREATE DATABASE AnyDoor DEFAULT CHARSET utf8mb4;"

# 2. 导入完整结构
mysql -u root -p AnyDoor < server/src/main/resources/schema_full.sql

# 3. 修改配置文件 application.yml
# spring.datasource.druid.url: jdbc:mysql://localhost:3306/AnyDoor
# spring.datasource.druid.username: your_user
# spring.datasource.druid.password: your_password

# 4. 启动应用
cd server && mvn spring-boot:run
```

---

## 🔧 常见问题

### ❌ Unknown column 'updated_at' 或其他字段缺失

**原因：** 数据库表结构不完整
**解决：** 删除表后重新导入

```bash
# 备份数据（如果有重要数据）
mysqldump -u root -p AnyDoor > backup.sql

# 删除旧表并重新导入
mysql -u root -p AnyDoor -e "DROP TABLE IF EXISTS cookie_bundle;"
mysql -u root -p AnyDoor < server/src/main/resources/schema_full.sql
```

---

### ❌ Table already exists

**原因：** 表已存在
**解决方案1：** 如果是开发环境，可以删除重建

```bash
mysql -u root -p AnyDoor -e "DROP DATABASE AnyDoor;"
mysql -u root -p -e "CREATE DATABASE AnyDoor DEFAULT CHARSET utf8mb4;"
mysql -u root -p AnyDoor < server/src/main/resources/schema_full.sql
```

**解决方案2：** 如果有重要数据，请先备份

```bash
mysqldump -u root -p AnyDoor > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🛡️ 安全建议

### 1. 修改默认管理员密码

```sql
-- 使用BCrypt生成新密码哈希: https://bcrypt-generator.com/
UPDATE `user`
SET `password` = '$2a$10$YOUR_NEW_BCRYPT_HASH'
WHERE `username` = 'admin';
```

### 2. 生产环境配置

```yaml
spring:
  datasource:
    druid:
      url: jdbc:mysql://your-host:3306/AnyDoor?useSSL=true&serverTimezone=UTC
      username: ${DB_USER}      # 使用环境变量
      password: ${DB_PASS}      # 使用环境变量
```

### 3. 定期备份

```bash
# 每日自动备份（crontab示例）
0 2 * * * mysqldump -u root -p'password' AnyDoor > /backup/anydoor_$(date +\%Y\%m\%d).sql
```

---

## 🗑️ 数据维护

### 清理过期Bundle

```sql
-- 手动清理
DELETE
FROM cookie_bundle
WHERE expire_at < UNIX_TIMESTAMP() * 1000;

-- 创建自动清理任务（MySQL事件）
CREATE
EVENT IF NOT EXISTS clean_expired_bundles
ON SCHEDULE EVERY 1 DAY
DO
DELETE
FROM cookie_bundle
WHERE expire_at < UNIX_TIMESTAMP() * 1000;

-- 启用事件调度器
SET
GLOBAL event_scheduler = ON;
```

### 查看表大小

```sql
SELECT
    table_name AS 'Table',
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'AnyDoor'
ORDER BY (data_length + index_length) DESC;
```

### 优化表性能

```sql
OPTIMIZE TABLE cookie_bundle;
OPTIMIZE TABLE user_bundle_reference;
```

---

## 📊 数据库配置要求

- **MySQL版本：** 5.7+ 或 8.0+
- **字符集：** utf8mb4
- **排序规则：** utf8mb4_unicode_ci
- **引擎：** InnoDB
- **时区：** UTC（推荐）

---

## 💡 提示

- ✅ 脚本使用 `DROP TABLE IF EXISTS`，可以重复执行
- ✅ 所有时间戳使用毫秒级 bigint 存储
- ✅ 密码字段使用 BCrypt 加密存储
- ✅ 包含必要的索引以优化查询性能
- ✅ 黑名单和日志表为可选功能

---

## 📞 获取帮助

如遇问题，请检查：

1. **MySQL版本**
   ```sql
   SELECT VERSION();
   ```

2. **表结构**
   ```sql
   DESC cookie_bundle;
   ```

3. **字符集**
   ```sql
   SHOW CREATE TABLE cookie_bundle;
   ```

---

**文件位置：** `server/src/main/resources/schema_full.sql`
