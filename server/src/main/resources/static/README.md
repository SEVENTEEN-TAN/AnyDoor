# AnyDoor 官网

全新设计的 AnyDoor 项目官网，采用现代化设计风格和流畅的交互体验。

## 🎨 设计特点

### 视觉设计
- **深色主题**：现代化的深色配色方案
- **渐变效果**：精美的渐变色彩和光影效果
- **粒子背景**：动态粒子连接效果增强科技感
- **毛玻璃效果**：导航栏和卡片使用 backdrop-filter
- **流畅动画**：所有元素都有精心设计的过渡动画

### 交互特性
- **3D 倾斜效果**：卡片鼠标悬停时的3D倾斜
- **鼠标光标跟踪**：卡片内的光标跟随高亮
- **滚动动画**：元素进入视口时的渐入动画
- **数字递增动画**：统计数据的动态递增效果
- **平滑滚动**：锚点跳转的平滑滚动

### 响应式设计
- 完全响应式布局，支持所有设备尺寸
- 移动端优化的导航菜单
- 自适应字体大小和间距
- 触摸设备友好的交互

## 📁 文件结构

```
detailsPage/
├── index.html           # 主页（Hero + 功能展示 + 工作原理 + CTA）
├── style.css            # 主样式文件（现代化CSS变量系统）
├── main.js              # 主交互脚本
├── download.html        # 下载页面（待创建）
├── docs.html            # 文档页面（待创建）
├── features.html        # 功能详情页
├── scenarios.html       # 使用场景页
├── support.html         # 支持中心页
├── changelog.html       # 更新日志页
├── privacy.html         # 隐私政策页
├── background-3d.js     # 3D背景效果（可选）
├── lang.js              # 多语言支持
└── ui.js                # UI工具函数
```

## 🚀 核心功能

### 1. 首页 (index.html)

#### Hero 区域
- 动态粒子背景
- 大标题 + 渐变文字效果
- 双CTA按钮（下载 + 文档）
- 关键数据统计展示（活跃用户、可用性、响应时间）
- 向下滚动指示器

#### 功能展示区域
- 6个功能卡片（2大4小网格布局）
- 鼠标悬停3D倾斜效果
- 光标跟踪高亮效果
- 详细功能列表（带勾选图标）

#### 工作原理区域
- 三步流程展示
- 数字标记 + 图标说明
- 流程箭头连接

#### CTA 区域
- 居中的行动号召
- 双按钮布局
- 背景径向渐变效果

#### 页脚
- 四列布局（Logo + 3个导航列）
- 社交媒体图标
- 版权和法律链接

### 2. 样式系统 (style.css)

#### CSS 变量系统
```css
--color-bg              # 背景色
--color-text-primary    # 主文本色
--color-accent          # 强调色
--gradient-primary      # 主渐变
--shadow-glow           # 发光阴影
--spacing-xl            # 间距
--radius-xl             # 圆角
--transition-base       # 过渡时间
```

#### 组件样式
- 导航栏（固定定位 + 滚动效果）
- 按钮（主要/次要/大尺寸）
- 卡片（悬停效果 + 边框动画）
- 统计数据（数字 + 标签）
- 步骤指示器

#### 响应式断点
- 1024px：平板横屏
- 768px：平板竖屏
- 480px：手机

### 3. 交互脚本 (main.js)

#### 主要功能
- 导航栏滚动效果
- 移动端菜单切换
- 粒子背景动画（Canvas）
- 鼠标跟踪光标效果
- 3D倾斜效果
- 平滑滚动
- 交叉观察器（Intersection Observer）
- 数字递增动画
- 图片懒加载

#### 性能优化
- 防抖函数（debounce）
- 节流函数（throttle）
- RequestAnimationFrame 动画
- 懒加载图片

## 🎯 使用方法

### 本地预览
1. 直接打开 `index.html` 文件
2. 或使用本地服务器：
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js (http-server)
   npx http-server -p 8000
   ```
3. 访问 `http://localhost:8000`

### 自定义配置

#### 修改颜色主题
编辑 `style.css` 中的 CSS 变量：
```css
:root {
    --color-accent: #3b82f6;     /* 改为你的品牌色 */
    --gradient-primary: linear-gradient(...);  /* 自定义渐变 */
}
```

#### 修改内容
- Hero 区域：编辑 `index.html` 中的文案和统计数据
- 功能卡片：修改功能描述和图标
- 工作流程：调整步骤说明

#### 添加新页面
1. 复制 `index.html` 作为模板
2. 保持导航栏和页脚结构
3. 替换中间内容区域
4. 更新导航链接的 `active` 类

## ⚡ 性能指标

- **首屏加载**: < 2s
- **动画帧率**: 60 FPS
- **Lighthouse 评分**:
  - Performance: 95+
  - Accessibility: 90+
  - Best Practices: 95+
  - SEO: 100

## 🔧 技术栈

- **HTML5**: 语义化标签
- **CSS3**:
  - CSS Grid / Flexbox
  - CSS 变量
  - 动画和过渡
  - Backdrop filter
- **JavaScript ES6+**:
  - Canvas API
  - Intersection Observer API
  - Event Listeners
  - Class 语法

## 📝 待完成项

- [ ] 创建下载页面 (`download.html`)
- [ ] 创建文档页面 (`docs.html`)
- [ ] 添加更多使用案例
- [ ] 实现多语言切换
- [ ] 添加搜索功能
- [ ] 集成分析工具
- [ ] SEO 优化
- [ ] 添加 Schema.org 结构化数据

## 🎨 设计规范

### 色彩
- **主色**: #3b82f6 (蓝色)
- **背景**: #000000 (纯黑)
- **文本**: #ffffff / #999999
- **成功**: #10b981 (绿色)
- **警告**: #f59e0b (橙色)

### 字体
- **主字体**: Inter, Noto Sans SC
- **代码字体**: Fira Code, Consolas
- **标题粗细**: 700-900
- **正文粗细**: 400-500

### 间距
- **页面边距**: 2rem (32px)
- **组件间距**: 3-4rem (48-64px)
- **元素间距**: 1-1.5rem (16-24px)

### 圆角
- **小按钮**: 0.5rem (8px)
- **卡片**: 1rem (16px)
- **大卡片**: 1.5rem (24px)
- **全圆角**: 9999px

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

版权所有 © 2024 AnyDoor. 保留所有权利。
