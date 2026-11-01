# 🔮 观象 - 毕业作品

基于 AI 的传统文化命理平台，包含八字排盘、塔罗牌、周公解梦、星座分析四个模块，并配套 RAG 知识库、多轮追问、管理后台与数据看板。

<p align="center">
  <img src="docs/screenshot.png" width="320" alt="观象首页">
</p>

▶️ [演示视频](docs/demo.mp4)（约 2 分 09 秒）

## ✨ 功能特性

| 模块 | 功能 | AI 能力 |
|------|------|---------|
| ☯️ 八字命理 | 节气定月、真太阳时、四柱、十神、藏干、纳音、五行、大运、神煞；全国 34 个省级行政区 / 362 个城市经度库 | ✅ RAG 增强命理分析 |
| 🃏 塔罗牌 | 78 张完整牌义、三张牌阵 / 凯尔特十字 / 关系牌阵、洗牌不重复 | ✅ 流式解读 + 结构化要点卡片 |
| 🌙 周公解梦 | 315 条知识库、分类浏览、关键词检索、分页 | ✅ BM25 检索增强 + 知识库依据展示 |
| ⭐ 星座分析 | 十二星座性格、运势、AI 深度分析、每日运势 | ✅ AI 分析 + 每日运势缓存 |
| 💬 AI 助手 | 多轮对话、会话持久化、追问上下文 | ✅ 流式输出 |
| 📜 记录中心 | 类型筛选、关键词搜索、收藏、标签、分页 | 自动保存 |
| 🛠️ 管理后台 | 数据看板、用户管理、记录管理、词条 CRUD | ECharts 可视化 |
| 📱 PWA | 离线缓存、添加到主屏幕、每日运势通知 | — |

## 🛠️ 技术栈

- **前端**：HTML5 + CSS3 + 原生 JavaScript + PWA（无构建链）
- **后端**：Flask 3 + SQLite
- **AI**：LongCat 大模型（SSE 流式输出、结构化 JSON 输出）
- **检索**：纯 Python BM25 + 中文 bigram 分词（无需 jieba / 向量模型）
- **认证**：JWT + 角色权限（user / admin）
- **部署**：Gunicorn + Nginx + Docker Compose

## 🚀 快速启动

### 方式一：一键启动（推荐）

双击 `start.bat`，浏览器访问 http://localhost:5001

### 方式二：手动启动

```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 配置 AI 密钥

在 `backend/.env` 中写入：

```env
LONGCAT_API_KEY=你的密钥
ZHANBU_SECRET_KEY=随机长字符串
ZHANBU_PASSWORD_SALT=随机盐值
```

### 创建管理员

```bash
cd backend
python create_admin.py admin 你的密码
```

然后用管理员账号登录，在「设置 → 管理后台」进入后台。

## 🧪 测试

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests -q
python -m pytest tests --cov=. --cov-report=term-missing
```

覆盖内容：八字排盘回归（立春边界、晚子时、真太阳时）、认证与修改密码、历史记录筛选/收藏/标签、BM25 检索、对话追问、结构化输出、管理后台权限、每日运势缓存。

## 🐳 Docker 部署

```bash
export LONGCAT_API_KEY=你的密钥
export ZHANBU_SECRET_KEY=随机长字符串
export ZHANBU_PASSWORD_SALT=随机盐值

docker compose up -d --build
docker compose exec web python create_admin.py admin 你的密码
```

Nginx 反向代理配置见根目录 `nginx.conf`，已针对 SSE 关闭缓冲。

## 📁 项目结构

```
├── backend/
│   ├── app.py                 # 主程序：API + 静态文件服务
│   ├── admin.py               # 管理后台 Blueprint
│   ├── models.py              # 数据库模型、迁移与数据访问
│   ├── auth.py                # JWT 认证与角色校验
│   ├── bazi_engine.py         # 八字排盘引擎（节气 / 真太阳时 / 大运）
│   ├── retriever.py           # BM25 检索器
│   ├── create_admin.py        # 管理员创建脚本
│   ├── knowledge/
│   │   ├── dreams.json        # 315 条解梦知识库
│   │   ├── tarot.json         # 78 张塔罗牌义（RAG 用）
│   │   ├── bazi_rules.json    # 命理规则库
│   │   └── build_dreams.py    # 解梦知识库生成脚本
│   ├── tests/                 # pytest 测试
│   ├── requirements.txt
│   └── requirements-dev.txt
├── js/
│   ├── api.js                 # API 封装（含 SSE / 结构化输出）
│   ├── auth.js                # 登录注册
│   ├── main.js                # 公共函数、解梦页、对话
│   ├── bazi.js                # 八字排盘前端
│   ├── bazi-regions.js        # 全国省份/城市经度库
│   ├── tarot-data.js          # 78 张塔罗牌库
│   ├── tarot.js               # 塔罗牌阵与抽牌
│   ├── longcat.js             # AI 调用封装
│   ├── admin.js               # 管理后台
│   ├── settings.js            # 设置页
│   ├── data.js                # 星座数据
│   └── pwa.js                 # PWA 与每日运势通知
├── css/style.css
├── index.html / auth.html / bazi.html / tarot.html
├── dream.html / zodiac.html / history.html / settings.html
├── admin.html                 # 管理后台页面
├── docs/architecture.md       # 架构、ER 图、时序图
├── Dockerfile / docker-compose.yml / nginx.conf
└── start.bat
```

## 🔑 核心设计

1. **八字引擎本地化**：节气用太阳视黄经法计算，年月柱按北京时间节气，日时柱按出生地真太阳时；支持十神、藏干、纳音、五行加权、大运与神煞。
2. **RAG 检索增强**：解梦与命理解读前，先用 BM25 从本地知识库检索 Top-K 条目注入 Prompt，减少模型幻觉，并在前端展示「知识库依据」。
3. **流式 + 结构化双通道**：日常解读走 SSE 流式输出；需要卡片化展示时调用 `/api/ai/structured`，后端校验 JSON，解析失败自动降级为纯文本。
4. **多轮对话持久化**：会话与消息落库，前端通过 `X-Conversation-Id` 续聊，刷新后可恢复。
5. **认证与权限**：JWT 7 天有效期，每次请求校验账号状态；管理员接口使用 `admin_required`，禁用账号立即失效。
6. **安全**：密码 SHA256 + 盐值；AI Key 仅存后端环境变量；SQL 全部参数化；前端对话内容做 HTML 转义。
7. **数据迁移**：`init_db` 使用 `PRAGMA table_info` 幂等加列，旧数据库升级不丢数据。
8. **PWA**：Service Worker 缓存基础页面；每日运势使用本地通知（Web Push 需要 VAPID，当前为打开应用时提醒）。

## 🔧 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `LONGCAT_API_KEY` | LongCat API 密钥 | 空（未配置时 AI 接口不可用） |
| `LONGCAT_API_URL` | API 地址 | `https://api.longcat.chat/openai/v1/chat/completions` |
| `LONGCAT_MODEL` | 模型名称 | `LongCat-2.0` |
| `ZHANBU_SECRET_KEY` | JWT 签名密钥 | 内置默认值（生产必须修改） |
| `ZHANBU_PASSWORD_SALT` | 密码盐值 | 内置默认值（生产必须修改） |
| `ZHANBU_DB_PATH` | SQLite 路径 | `backend/data.db` |
| `PORT` | 监听端口 | `5001` |
| `FLASK_DEBUG` | 是否开启调试 | `1` |

## 📝 论文方向建议

- 节气与真太阳时算法在八字排盘中的实现
- BM25 + 中文 bigram 在传统文化知识库检索中的应用
- 大模型流式输出与结构化 JSON 输出的校验降级
- JWT 角色权限与账号状态校验设计
- PWA、Docker 与自动化测试在小型 Web 系统中的工程实践

更多架构图与接口清单见 [docs/architecture.md](docs/architecture.md)。
