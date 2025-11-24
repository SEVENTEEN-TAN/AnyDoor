# 服务器配置说明

## 数据库配置

### 方式1: 使用环境变量（推荐）

设置以下环境变量：

**Windows (PowerShell):**
```powershell
$env:DB_HOST="124.223.172.114"
$env:DB_PORT="3306"
$env:DB_NAME="AnyDoor"
$env:DB_USER="AnyDoor"
$env:DB_PASS="your_password"
```

**Windows (CMD):**
```cmd
set DB_HOST=124.223.172.114
set DB_PORT=3306
set DB_NAME=AnyDoor
set DB_USER=AnyDoor
set DB_PASS=your_password
```

**Linux / macOS:**
```bash
export DB_HOST="124.223.172.114"
export DB_PORT="3306"
export DB_NAME="AnyDoor"
export DB_USER="AnyDoor"
export DB_PASS="your_password"
```

### 方式2: 使用配置文件

1. 复制 `src/main/resources/application.yml.example` 为 `application.yml`
2. 编辑 `application.yml`，填入实际的数据库连接信息
3. **注意：** `application.yml` 已添加到 `.gitignore`，不会被提交到版本控制

## 启动服务

```bash
# 使用 Maven
mvn spring-boot:run

# 或打包后运行
mvn clean package
java -jar target/*.jar
```

## 安全提示

⚠️ **重要：**
- 不要在代码中硬编码数据库密码
- 不要将包含敏感信息的 `application.yml` 提交到 Git
- 生产环境请使用密钥管理服务（如 AWS Secrets Manager、Azure Key Vault）
- 定期更换数据库密码

## 默认配置

- 服务端口: `8080`
- Sa-Token 有效期: `7天`
- 数据库连接池: Druid
  - 初始连接数: 3
  - 最大连接数: 20
  - 最小空闲连接数: 3
