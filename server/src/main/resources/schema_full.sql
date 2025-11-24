-- ============================================
-- AnyDoor 数据库完整架构（包含分享优化）
-- 版本: v3.1
-- 创建日期: 2025-11-14
-- 说明: 包含所有表的完整定义
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- 删除现有表（按依赖关系逆序删除）
DROP TABLE IF EXISTS cross_group_share;
DROP TABLE IF EXISTS bundle_share;
DROP TABLE IF EXISTS user_bundle_reference;
DROP TABLE IF EXISTS cookie_bundle;
DROP TABLE IF EXISTS user_group_relation;
DROP TABLE IF EXISTS user_group;
DROP TABLE IF EXISTS user;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS user
(
    id             VARCHAR(64) PRIMARY KEY COMMENT '用户ID',
    username       VARCHAR(128) UNIQUE NOT NULL COMMENT '用户名',
    password_hash  VARCHAR(256)        NOT NULL COMMENT '密码哈希',
    email          VARCHAR(255) UNIQUE COMMENT '邮箱',
    display_name   VARCHAR(128) COMMENT '显示名称',
    role           VARCHAR(32)         NOT NULL DEFAULT 'NORMAL_USER' COMMENT '角色: GLOBAL_ADMIN/GROUP_OWNER/NORMAL_USER',
    status         VARCHAR(32)         NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/DISABLED/BANNED',
    parent_user_id VARCHAR(64) COMMENT '父账号ID（子账号专用）',
    created_at     BIGINT              NOT NULL COMMENT '创建时间戳',
    updated_at     BIGINT              NOT NULL COMMENT '更新时间戳',

    -- 检查约束
    CONSTRAINT chk_user_role CHECK (role IN ('GLOBAL_ADMIN', 'GROUP_OWNER', 'NORMAL_USER')),
    CONSTRAINT chk_user_status CHECK (status IN ('ACTIVE', 'DISABLED', 'BANNED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='用户表';

-- 用户表索引
CREATE INDEX idx_user_username ON user (username);
CREATE INDEX idx_user_role ON user (role);
CREATE INDEX idx_user_status ON user (status);
CREATE INDEX idx_user_parent ON user (parent_user_id);

INSERT INTO anydoor.user (id, username, password_hash, email, display_name, role, status, parent_user_id, created_at, updated_at)
VALUES ('admin', 'admin', '$2a$10$UMnMrn2Q6I6fO.V4cG8H4.DZhbHQf1PScELLCor2VEOLluF1wpkqS', 'admin@anydoor.local', null, 'GLOBAL_ADMIN', 'ACTIVE', null, 1763033312000, 1763033312000);

-- 2. 用户组表
CREATE TABLE IF NOT EXISTS user_group
(
    id          VARCHAR(64) PRIMARY KEY COMMENT '组ID',
    group_name  VARCHAR(128) UNIQUE NOT NULL COMMENT '组名称',
    owner_id    VARCHAR(64)         NOT NULL COMMENT '组主账号ID',
    description TEXT COMMENT '组描述',
    status      VARCHAR(32)         NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/DISABLED',
    max_members INT                          DEFAULT 100 COMMENT '最大成员数',
    created_at  BIGINT              NOT NULL COMMENT '创建时间戳',
    updated_at  BIGINT              NOT NULL COMMENT '更新时间戳',

    -- 外键约束
    CONSTRAINT fk_group_owner FOREIGN KEY (owner_id)
        REFERENCES user (id) ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_group_status CHECK (status IN ('ACTIVE', 'DISABLED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='用户组表';

-- 用户组表索引
CREATE INDEX idx_group_owner ON user_group (owner_id);
CREATE INDEX idx_group_status ON user_group (status);

-- 3. 用户组关系表
CREATE TABLE IF NOT EXISTS user_group_relation
(
    id            VARCHAR(64) PRIMARY KEY COMMENT '关系ID',
    user_id       VARCHAR(64) NOT NULL COMMENT '用户ID',
    group_id      VARCHAR(64) NOT NULL COMMENT '组ID',
    role_in_group VARCHAR(32) NOT NULL DEFAULT 'MEMBER' COMMENT '组内角色: OWNER/ADMIN/MEMBER',
    joined_at     BIGINT      NOT NULL COMMENT '加入时间戳',

    -- 外键约束
    CONSTRAINT fk_relation_user FOREIGN KEY (user_id)
        REFERENCES user (id) ON DELETE CASCADE,
    CONSTRAINT fk_relation_group FOREIGN KEY (group_id)
        REFERENCES user_group (id) ON DELETE CASCADE,

    -- 唯一约束
    CONSTRAINT uk_user_group UNIQUE (user_id, group_id),

    -- 检查约束
    CONSTRAINT chk_relation_role CHECK (role_in_group IN ('OWNER', 'ADMIN', 'MEMBER'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='用户组关系表';

-- 用户组关系表索引
CREATE INDEX idx_relation_user ON user_group_relation (user_id);
CREATE INDEX idx_relation_group ON user_group_relation (group_id);

-- 4. Cookie Bundle 表
CREATE TABLE IF NOT EXISTS cookie_bundle
(
    id           VARCHAR(64) PRIMARY KEY COMMENT 'Bundle ID',
    owner_id     VARCHAR(64)  NOT NULL COMMENT '所有者ID',
    group_id     VARCHAR(64) COMMENT '所属组ID',
    share_mode   VARCHAR(32)  NOT NULL DEFAULT 'GROUP_ONLY' COMMENT '分享模式: GROUP_ONLY/CROSS_GROUP/GLOBAL',
    name         VARCHAR(255) NOT NULL COMMENT 'Bundle名称',
    description  TEXT COMMENT '描述',
    tags         VARCHAR(512) COMMENT '标签（逗号分隔）',
    host         VARCHAR(255) NOT NULL COMMENT '站点hostname',
    etld1        VARCHAR(255) NOT NULL COMMENT 'eTLD+1',
    payload      MEDIUMTEXT   NOT NULL COMMENT '加密后的数据',
    expire_at    BIGINT       NOT NULL COMMENT '过期时间戳',
    created_at   BIGINT       NOT NULL COMMENT '创建时间戳',
    updated_at   BIGINT COMMENT '更新时间戳',
    accessed_at  BIGINT COMMENT '最后访问时间戳',
    access_count INT                   DEFAULT 0 COMMENT '访问次数',

    -- 外键约束
    CONSTRAINT fk_bundle_owner FOREIGN KEY (owner_id)
        REFERENCES user (id) ON DELETE CASCADE,
    CONSTRAINT fk_bundle_group FOREIGN KEY (group_id)
        REFERENCES user_group (id) ON DELETE SET NULL,

    -- 检查约束
    CONSTRAINT chk_bundle_share_mode CHECK (share_mode IN ('GROUP_ONLY', 'PRIVATE', 'PUBLIC'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='Cookie Bundle表';

-- Cookie Bundle 表索引
CREATE INDEX idx_bundle_owner ON cookie_bundle (owner_id);
CREATE INDEX idx_bundle_group ON cookie_bundle (group_id);
CREATE INDEX idx_bundle_share_mode ON cookie_bundle (share_mode);
CREATE INDEX idx_bundle_expire ON cookie_bundle (expire_at);
CREATE INDEX idx_bundle_host ON cookie_bundle (host);

-- 6. Bundle 分享记录表（新增）
CREATE TABLE IF NOT EXISTS bundle_share
(
    id           VARCHAR(64) PRIMARY KEY COMMENT '分享记录ID',
    bundle_id    VARCHAR(64)        NOT NULL COMMENT 'Bundle ID',
    owner_id     VARCHAR(64)        NOT NULL COMMENT '所有者ID',
    share_token  VARCHAR(64) UNIQUE NOT NULL COMMENT '分享令牌',
    status       VARCHAR(32)        NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/REVOKED/DELETED',
    used_count   INT                         DEFAULT 0 COMMENT '使用次数',
    created_at   BIGINT             NOT NULL COMMENT '创建时间戳',
    last_used_at BIGINT COMMENT '最后使用时间戳',
    revoked_at   BIGINT COMMENT '撤销时间戳',

    -- 外键约束
    CONSTRAINT fk_share_bundle FOREIGN KEY (bundle_id)
        REFERENCES cookie_bundle (id) ON DELETE CASCADE,
    CONSTRAINT fk_share_owner FOREIGN KEY (owner_id)
        REFERENCES user (id) ON DELETE CASCADE,

    -- 检查约束
    CONSTRAINT chk_share_status CHECK (status IN ('ACTIVE', 'REVOKED', 'DELETED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='Bundle分享记录表';

-- Bundle 分享记录表索引
CREATE INDEX idx_share_bundle ON bundle_share (bundle_id);
CREATE INDEX idx_share_token ON bundle_share (share_token);
CREATE INDEX idx_share_owner ON bundle_share (owner_id);
CREATE INDEX idx_share_status ON bundle_share (status);
CREATE INDEX idx_share_created ON bundle_share (created_at);

-- 5. 用户 Bundle 引用表
CREATE TABLE IF NOT EXISTS user_bundle_reference
(
    id             VARCHAR(64) PRIMARY KEY COMMENT '引用ID',
    user_id        VARCHAR(64) NOT NULL COMMENT '用户ID',
    bundle_id      VARCHAR(64) NOT NULL COMMENT 'Bundle ID',
    reference_type VARCHAR(32) NOT NULL COMMENT '引用类型: OWNER/IMPORTED/GROUP_SHARED',
    is_visible     BOOLEAN DEFAULT TRUE COMMENT '是否可见（软删除）',
    share_id       VARCHAR(64) COMMENT '分享记录ID（通过哪个分享导入的）',
    imported_at    BIGINT COMMENT '导入时间戳',
    imported_from  VARCHAR(512) COMMENT '导入来源',

    -- 外键约束
    CONSTRAINT fk_reference_user FOREIGN KEY (user_id)
        REFERENCES user (id) ON DELETE CASCADE,
    CONSTRAINT fk_reference_bundle FOREIGN KEY (bundle_id)
        REFERENCES cookie_bundle (id) ON DELETE CASCADE,
    CONSTRAINT fk_reference_share FOREIGN KEY (share_id)
        REFERENCES bundle_share (id) ON DELETE SET NULL,

    -- 检查约束
    CONSTRAINT chk_reference_type CHECK (reference_type IN ('OWNER', 'IMPORTED', 'GROUP_SHARED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='用户Bundle引用表';

-- 用户 Bundle 引用表索引
CREATE INDEX idx_reference_user ON user_bundle_reference (user_id);
CREATE INDEX idx_reference_bundle ON user_bundle_reference (bundle_id);
CREATE INDEX idx_reference_type ON user_bundle_reference (reference_type);
CREATE INDEX idx_reference_visible ON user_bundle_reference (is_visible);
CREATE INDEX idx_reference_share ON user_bundle_reference (share_id);

-- 7. 跨组分享表
CREATE TABLE IF NOT EXISTS cross_group_share
(
    id              VARCHAR(64) PRIMARY KEY COMMENT '分享记录ID',
    bundle_id       VARCHAR(64) NOT NULL COMMENT 'Bundle ID',
    target_group_id VARCHAR(64) NOT NULL COMMENT '目标组ID',
    shared_by       VARCHAR(64) NOT NULL COMMENT '分享者ID',
    shared_at       BIGINT      NOT NULL COMMENT '分享时间戳',

    -- 外键约束
    CONSTRAINT fk_cross_share_bundle FOREIGN KEY (bundle_id)
        REFERENCES cookie_bundle (id) ON DELETE CASCADE,
    CONSTRAINT fk_cross_share_target_group FOREIGN KEY (target_group_id)
        REFERENCES user_group (id) ON DELETE CASCADE,
    CONSTRAINT fk_cross_share_shared_by FOREIGN KEY (shared_by)
        REFERENCES user (id) ON DELETE CASCADE,

    -- 唯一约束
    CONSTRAINT uk_bundle_target UNIQUE (bundle_id, target_group_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='跨组分享表';

-- 跨组分享表索引
CREATE INDEX idx_cross_share_bundle ON cross_group_share (bundle_id);
CREATE INDEX idx_cross_share_target_group ON cross_group_share (target_group_id);

-- 8. 操作审计日志表
CREATE TABLE IF NOT EXISTS audit_log
(
    id            VARCHAR(64) PRIMARY KEY COMMENT '日志ID',
    user_id       VARCHAR(64) COMMENT '操作用户ID',
    action        VARCHAR(64) NOT NULL COMMENT '操作类型',
    resource_type VARCHAR(64) COMMENT '资源类型',
    resource_id   VARCHAR(64) COMMENT '资源ID',
    ip_address    VARCHAR(64) COMMENT '操作IP地址',
    user_agent    TEXT COMMENT 'User Agent',
    result        VARCHAR(32) NOT NULL COMMENT '结果: SUCCESS/FAILURE',
    error_message TEXT COMMENT '错误信息',
    created_at    BIGINT      NOT NULL COMMENT '操作时间戳',

    -- 外键约束
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
        REFERENCES user (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='操作审计日志表';

-- 操作审计日志表索引
CREATE INDEX idx_audit_user ON audit_log (user_id);
CREATE INDEX idx_audit_action ON audit_log (action);
CREATE INDEX idx_audit_resource ON audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_log (created_at);

-- ============================================
-- 初始化数据（可选）
-- ============================================

-- 创建默认管理员账号（密码: admin123，需要使用 BCrypt 加密）
-- INSERT INTO user (id, username, password_hash, role, status, created_at, updated_at)
-- VALUES (
--     UUID(),
--     'admin',
--     '$2a$12$...',  -- BCrypt hash of 'admin123'
--     'GLOBAL_ADMIN',
--     'ACTIVE',
--     UNIX_TIMESTAMP() * 1000,
--     UNIX_TIMESTAMP() * 1000
-- );

SET FOREIGN_KEY_CHECKS = 1;
