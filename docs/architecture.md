# 系统架构说明

本文档用于毕业设计论文的架构章节，包含总体架构、数据模型、核心流程与接口清单。

## 1. 系统概述

本系统是一个基于大模型的中国传统命理文化体验平台，包含八字排盘、塔罗牌、周公解梦、星座分析四个模块，并提供 AI 解读、历史记录、收藏标签、管理后台等平台能力。

技术栈：

- 前端：原生 HTML5 / CSS3 / JavaScript + PWA，无构建链
- 后端：Flask 3 + SQLite
- AI：LongCat 大模型（OpenAI 兼容接口，SSE 流式输出）
- 检索：纯 Python BM25 + 中文 bigram 分词（RAG）
- 部署：Gunicorn + Nginx + Docker Compose

## 2. 总体架构

```mermaid
flowchart TB
    subgraph Client["浏览器 / PWA"]
        UI["页面：首页 / 八字 / 塔罗 / 解梦 / 星座 / 记录 / 设置 / 后台"]
        JS["JS 模块：api.js / bazi.js / tarot.js / main.js / admin.js"]
        SW["Service Worker（离线缓存 + 通知）"]
    end

    subgraph Server["Flask 后端"]
        APP["app.py 路由层"]
        AUTH["auth.py JWT 认证"]
        ADMIN["admin.py 管理接口"]
        BAZI["bazi_engine.py 排盘引擎"]
        RAG["retriever.py BM25 检索"]
        MODELS["models.py 数据访问"]
    end

    subgraph Data["数据层"]
        DB[("SQLite data.db")]
        KB["知识库 JSON：dreams / tarot / bazi_rules"]
    end

    LLM["LongCat API"]

    UI --> JS --> APP
    SW --> UI
    APP --> AUTH
    APP --> ADMIN
    APP --> BAZI
    APP --> RAG
    APP --> MODELS
    ADMIN --> MODELS
    RAG --> KB
    MODELS --> DB
    APP -->|SSE 流式| LLM
```

## 3. 数据库 ER 图

```mermaid
erDiagram
    USERS ||--o{ READINGS : owns
    USERS ||--o{ CONVERSATIONS : owns
    CONVERSATIONS ||--o{ MESSAGES : contains
    USERS ||--o{ AI_USAGE : generates

    USERS {
        int id PK
        string username UK
        string password_hash
        string role "user/admin"
        string status "active/disabled"
        datetime created_at
    }
    READINGS {
        int id PK
        int user_id FK
        string type
        text input_data
        text result
        int is_favorite
        string tags
        datetime created_at
    }
    CONVERSATIONS {
        int id PK
        int user_id FK
        string title
        string context_type
        int context_id
        datetime created_at
        datetime updated_at
    }
    MESSAGES {
        int id PK
        int conversation_id FK
        string role
        text content
        datetime created_at
    }
    FORTUNE_CACHE {
        int id PK
        string sign
        string date
        text content
    }
    AI_USAGE {
        int id PK
        int user_id
        string endpoint
        datetime created_at
    }
```

## 4. 八字排盘流程

```mermaid
flowchart TD
    A["输入：公历生日、时分、性别、出生地经度"] --> B["真太阳时校正：经度差 + 均时差"]
    B --> C["年柱：以立春为界"]
    B --> D["月柱：以 12 节为界 + 五虎遁"]
    B --> E["日柱：儒略日推算，23 点换日"]
    E --> F["时柱：五鼠遁"]
    C --> G["四柱：天干地支"]
    D --> G
    F --> G
    G --> H["藏干 / 十神 / 纳音"]
    G --> I["五行力量加权统计"]
    G --> J["大运：顺逆、起运岁数、十步大运"]
    G --> K["神煞：天贵 / 桃花 / 驿马 / 华盖 / 羊刃"]
    H --> L["结构化命盘 JSON"]
    I --> L
    J --> L
    K --> L
    L --> M["前端渲染 + RAG 增强 AI 解读"]
```

节气采用太阳视黄经法（Meeus 低精度公式 + 牛顿迭代），1900–2100 年误差约 ±10 分钟；立春、月柱边界按北京时间节气判断，日柱与时柱按出生地真太阳时判断。

## 5. RAG 检索流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant A as Flask
    participant R as BM25 检索器
    participant K as 知识库 JSON
    participant L as LongCat

    U->>F: 描述梦境 / 提交命盘
    F->>A: POST /api/ai/dream 或 /api/ai/bazi
    A->>R: retrieve(query, source)
    R->>K: 读取 dreams / bazi_rules
    R-->>A: Top-K 条目与分数
    A->>L: system + 检索上下文 + 用户输入
    L-->>A: SSE 流式回复
    A-->>F: 逐块转发
    F-->>U: 实时渲染
```

检索器不依赖 jieba 或向量模型：中文按单字 + bigram 切分，英文数字按词切分，使用 BM25（k1=1.5，b=0.75）计算相关性，兼顾离线部署与可解释性。

## 6. 对话追问时序

```mermaid
sequenceDiagram
    participant F as 前端
    participant A as Flask
    participant D as SQLite
    participant L as LongCat

    F->>A: POST /api/ai/chat（message, conversation_id）
    A->>D: 校验会话归属 / 保存用户消息
    A->>D: 读取最近 20 条消息
    A->>L: system + 历史消息
    L-->>A: SSE 流
    A-->>F: 转发内容 + X-Conversation-Id
    A->>D: 流结束后保存助手消息与历史记录
```

## 7. 主要接口

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | /api/register | 注册 | 否 |
| POST | /api/login | 登录 | 否 |
| GET | /api/user | 当前用户 | 是 |
| PUT | /api/user/password | 修改密码 | 是 |
| DELETE | /api/user | 注销账号 | 是 |
| GET | /api/bazi/calc | 八字排盘 | 是 |
| GET | /api/dreams | 解梦词条搜索/分页 | 否 |
| GET | /api/dreams/categories | 解梦分类 | 否 |
| GET | /api/dreams/rag | RAG 检索结果 | 否 |
| POST | /api/ai/dream | 解梦 AI（RAG） | 是 |
| POST | /api/ai/bazi | 八字 AI（RAG） | 是 |
| POST | /api/ai/chat | 多轮对话 | 是 |
| POST | /api/ai/structured | 结构化 JSON 输出 | 是 |
| GET | /api/history | 历史记录（类型/关键词/收藏/分页） | 是 |
| PUT | /api/history/:id/favorite | 收藏 | 是 |
| PUT | /api/history/:id/tags | 标签 | 是 |
| GET | /api/fortune/daily | 每日运势（按日缓存） | 是 |
| GET | /api/admin/stats | 后台统计 | 管理员 |
| GET/PUT/DELETE | /api/admin/users/* | 用户管理 | 管理员 |
| GET/DELETE | /api/admin/readings/* | 记录管理 | 管理员 |
| GET/POST/PUT/DELETE | /api/admin/dreams/* | 词条管理 | 管理员 |

## 8. 测试与部署

测试：

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests -q
python -m pytest tests --cov=. --cov-report=term-missing
```

容器部署：

```bash
# 1. 配置密钥
export LONGCAT_API_KEY=你的密钥
export ZHANBU_SECRET_KEY=随机长字符串
export ZHANBU_PASSWORD_SALT=随机盐值

# 2. 构建并启动
docker compose up -d --build

# 3. 创建管理员
docker compose exec web python create_admin.py admin 你的密码
```

Nginx 反向代理配置见根目录 `nginx.conf`，其中已关闭 `proxy_buffering` 以支持 SSE 流式输出。

## 9. 论文可展开的技术点

1. 节气与真太阳时算法：太阳视黄经、均时差、立春换年、23 点换日。
2. BM25 检索与中文 bigram 分词在传统文化知识库中的应用。
3. 大模型流式输出与结构化 JSON 输出的校验/降级策略。
4. 基于 JWT 的认证、角色权限与账号状态校验。
5. 平台工程实践：幂等数据库迁移、PWA 缓存、Docker 部署、自动化测试。
