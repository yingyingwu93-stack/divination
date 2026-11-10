# 部署与打包指南

本项目打包成 APK 需要：**后端部署到云端** + **Capacitor 打包**。

---

## 一、部署后端（Render）

### 1. 注册 Render
- 打开 https://render.com/
- 点 "Get Started" → "Sign up with GitHub"
- 授权连接你的 GitHub 账号（`yingyingwu93-stack`）

### 2. 创建 Blueprint
- 登录后点 **New** → **Blueprint**
- 选择仓库 **divination**
- Render 会自动读取根目录的 `render.yaml`

### 3. 填写环境变量
| 变量名 | 值 |
|--------|-----|
| `LONGCAT_API_KEY` | `ak_2HV5B31gu9tE2jm9WO1fW3AN1lr3I` |
| `ZHANBU_SECRET_KEY` | 留空（Render 自动生成） |
| `ZHANBU_PASSWORD_SALT` | 留空（Render 自动生成） |

### 4. 点击 "Apply" 开始部署
- 部署约需 5-10 分钟
- 完成后得到后端地址：`https://guanxiang-backend.onrender.com`

### 5. 验证后端
浏览器打开 `https://guanxiang-backend.onrender.com/api/health`
应返回：`{"status": "ok", "model": "LongCat-2.5"}`

---

## 二、打包 APK

### 前提
- 已安装 Android Studio（自带 Android SDK）
- 后端已部署完成，拿到地址

### 一键打包
```bash
cd D:\桌面\占卜
node build-apk.js https://guanxiang-backend.onrender.com
```

脚本会自动完成：
1. 把后端地址写入 `js/api.js`
2. 复制前端文件到 `www/`
3. 同步到 Android 项目
4. 调用 Gradle 生成 APK

### 输出位置
```
android\app\build\outputs\apk\debug\app-debug.apk
```

### 安装到手机
1. 把 `app-debug.apk` 发到手机（微信/QQ/数据线均可）
2. 点击安装
3. 首次安装需允许「安装未知来源应用」

---

## 三、手动打包（可选）

如果一键脚本失败，可以手动操作：

```bash
# 1. 改 API 地址（编辑 js/api.js 第 6 行）
const BACKEND_URL = 'https://guanxiang-backend.onrender.com/api';

# 2. 用 Android Studio 打开 android 目录

# 3. 菜单：Build → Build Bundle(s) / APK(s) → Build APK(s)

# 4. 等待构建完成，APK 在：
#    android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 常见问题

### Q: Render 提示要绑定信用卡？
A: 免费版绑卡只做身份验证，**不会扣费**。招行万事达卡（Mastercard）可用。

### Q: Render 免费版会休眠？
A: 15 分钟无请求会休眠，下次请求需等 30-50 秒恢复。APK 首次打开慢属正常。

### Q: 构建报错 "SDK location not found"？
A: 需要在 Android Studio 里确认 SDK 已安装：
File → Settings → Appearance & Behavior → System Settings → Android SDK

### Q: 手机安装后打不开 / 白屏？
A: 检查：
1. 后端地址是否正确（`js/api.js` 第 6 行）
2. 后端是否已部署且能公网访问
3. 手机网络是否正常

---

## 项目结构（打包相关）

```
占卜/
├── js/api.js              ← API 地址在这里改
├── capacitor.config.json  ← Capacitor 配置
├── android/               ← Android 原生项目（不提交到 git）
├── www/                   ← 前端副本，打包用（不提交到 git）
├── build-apk.js           ← 一键打包脚本
└── render.yaml            ← Render 部署配置
```
