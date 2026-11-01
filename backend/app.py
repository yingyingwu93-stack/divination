"""
观象后端
提供用户认证、历史记录、AI 代理接口
"""

from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import requests
import json
import re
import time
import os
import hashlib
import random
from datetime import datetime, timedelta, timezone

from models import (
    create_user, verify_user, get_user_by_id, set_user_birth_date,
    save_reading, get_readings, delete_reading, get_reading,
    count_readings, set_reading_favorite, update_reading_tags,
    get_db, hash_password, log_ai_usage,
    create_conversation, get_conversation, add_message,
    get_messages, list_conversations, update_conversation_context,
    get_fortune_cache, save_fortune_cache
)
from auth import generate_token, login_required, admin_required
from bazi_engine import calculate_bazi
from retriever import (
    list_dreams, dream_categories, get_dream, rag_context
)
from admin import admin_bp

# 前端静态文件目录（项目根目录）
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.json.sort_keys = False
CORS(app)
app.register_blueprint(admin_bp)


# ==================== 静态文件服务 ====================
@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    # 不拦截 API 路由
    if path.startswith("api/"):
        return jsonify({"error": "Not Found"}), 404
    file_path = os.path.join(FRONTEND_DIR, path)
    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")

# ==================== 配置（优先从环境变量读取）====================
def _load_env(path):
    """极简 .env 加载器，避免额外依赖"""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

LONGCAT_API_KEY = os.environ.get("LONGCAT_API_KEY", "")
LONGCAT_API_URL = os.environ.get("LONGCAT_API_URL", "https://api.longcat.chat/openai/v1/chat/completions")
MODEL_NAME = os.environ.get("LONGCAT_MODEL", "LongCat-2.0")
# =============================================

# 启动时检查 API Key
if not LONGCAT_API_KEY:
    print("[!] 未配置 LONGCAT_API_KEY，AI 相关接口将无法使用")
    print("    配置方式一：在 backend/.env 里写 LONGCAT_API_KEY=你的密钥")
    print("    配置方式二：设置同名环境变量")


# ==================== 用户认证接口 ====================
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "用户名和密码不能为空"}), 400
    if len(username) < 2 or len(username) > 20:
        return jsonify({"success": False, "error": "用户名长度需在 2-20 个字符之间"}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "密码长度至少 6 位"}), 400

    if create_user(username, password):
        return jsonify({"success": True, "message": "注册成功"})
    else:
        return jsonify({"success": False, "error": "该用户名已被注册"}), 400


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    user = verify_user(username, password)
    if user:
        token = generate_token(user["id"], user["username"], user.get("role", "user"))
        return jsonify({
            "success": True,
            "token": token,
            "user": user
        })
    else:
        return jsonify({"success": False, "error": "用户名或密码错误"}), 401


@app.route("/api/user", methods=["GET"])
@login_required
def get_current_user():
    user = get_user_by_id(request.current_user["user_id"])
    return jsonify({"success": True, "user": user})


@app.route("/api/user/birth", methods=["PUT"])
@login_required
def save_birth_date():
    data = request.get_json() or {}
    value = (data.get("birth_date") or "").strip()
    if not value:
        return jsonify({"success": False, "error": "请提供出生日期"}), 400
    try:
        birth = datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return jsonify({"success": False, "error": "出生日期格式应为 YYYY-MM-DD"}), 400
    if not (1900 <= birth.year <= 2100):
        return jsonify({"success": False, "error": "年份需在 1900-2100 之间"}), 400

    if not set_user_birth_date(request.current_user["user_id"], value):
        return jsonify({"success": False, "error": "用户不存在"}), 404
    return jsonify({"success": True, "birth_date": value})


@app.route("/api/user/password", methods=["PUT"])
@login_required
def change_password():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    if not old_password or not new_password:
        return jsonify({"success": False, "error": "请填写完整"}), 400

    if len(new_password) < 6:
        return jsonify({"success": False, "error": "新密码至少6位"}), 400

    # 验证旧密码
    user = verify_user(request.current_user["username"], old_password)
    if not user:
        return jsonify({"success": False, "error": "当前密码错误"}), 400

    # 更新密码
    conn = get_db()
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (hash_password(new_password), request.current_user["user_id"])
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/user", methods=["DELETE"])
@login_required
def delete_account():
    data = request.get_json()
    password = data.get("password", "") if data else ""

    if not password:
        return jsonify({"success": False, "error": "请输入密码"}), 400

    # 验证密码
    user = verify_user(request.current_user["username"], password)
    if not user:
        return jsonify({"success": False, "error": "密码错误"}), 400

    # 删除用户（级联删除历史记录）
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id = ?", (request.current_user["user_id"],))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ==================== 历史记录接口 ====================
@app.route("/api/history", methods=["GET"])
@login_required
def list_history():
    reading_type = request.args.get("type", "").strip() or None
    keyword = request.args.get("keyword", "").strip()
    favorite = request.args.get("favorite", "").lower() in ("1", "true", "yes")
    try:
        page = max(1, int(request.args.get("page", 1)))
        page_size = min(100, max(1, int(request.args.get("page_size", 20))))
    except ValueError:
        return jsonify({"success": False, "error": "分页参数错误"}), 400

    user_id = request.current_user["user_id"]
    readings = get_readings(
        user_id, reading_type,
        limit=page_size, offset=(page - 1) * page_size,
        keyword=keyword, favorite=favorite,
    )
    total = count_readings(user_id, reading_type, keyword, favorite)
    return jsonify({
        "success": True,
        "readings": readings,
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@app.route("/api/history", methods=["POST"])
@login_required
def add_history():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    reading_type = data.get("type", "").strip()
    input_data = data.get("input_data", "")
    result = data.get("result", "")

    if not reading_type or not result:
        return jsonify({"success": False, "error": "缺少必要参数"}), 400

    reading_id = save_reading(
        request.current_user["user_id"], reading_type, input_data, result
    )
    return jsonify({"success": True, "reading_id": reading_id})


@app.route("/api/history/<int:reading_id>", methods=["DELETE"])
@login_required
def remove_history(reading_id):
    if delete_reading(request.current_user["user_id"], reading_id):
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "记录不存在"}), 404


@app.route("/api/history/<int:reading_id>/favorite", methods=["PUT"])
@login_required
def favorite_history(reading_id):
    data = request.get_json() or {}
    favorite = bool(data.get("favorite"))
    if set_reading_favorite(request.current_user["user_id"], reading_id, favorite):
        return jsonify({"success": True, "favorite": favorite})
    return jsonify({"success": False, "error": "记录不存在"}), 404


@app.route("/api/history/<int:reading_id>/tags", methods=["PUT"])
@login_required
def tag_history(reading_id):
    data = request.get_json() or {}
    tags = data.get("tags", "")
    if isinstance(tags, list):
        tags = ",".join(str(t).strip() for t in tags if str(t).strip())
    tags = str(tags).strip()[:100]
    if update_reading_tags(request.current_user["user_id"], reading_id, tags):
        return jsonify({"success": True, "tags": tags})
    return jsonify({"success": False, "error": "记录不存在"}), 404


# ==================== 八字排盘接口 ====================
@app.route("/api/bazi/calc", methods=["POST"])
@login_required
def bazi_calc():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    try:
        year = int(data.get("year"))
        month = int(data.get("month"))
        day = int(data.get("day"))
        hour = int(data.get("hour", 0))
        minute = int(data.get("minute", 0))
        longitude = float(data.get("longitude", 120))
        gender = data.get("gender", "male")
        location = data.get("location", "")
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "出生信息格式错误"}), 400

    if not (1900 <= year <= 2100):
        return jsonify({"success": False, "error": "年份需在 1900-2100 之间"}), 400
    if gender not in ("male", "female"):
        return jsonify({"success": False, "error": "性别参数错误"}), 400

    try:
        result = calculate_bazi(year, month, day, hour, minute,
                                longitude, gender, location)
    except ValueError as e:
        return jsonify({"success": False, "error": f"日期无效：{e}"}), 400

    return jsonify({"success": True, "data": result})


# ==================== AI 代理接口 ====================
def _sse_stream(messages, max_tokens=2000, temperature=0.8, endpoint="chat",
                on_complete=None):
    """调用 LongCat 并转成 SSE；统一处理错误与调用统计

    on_complete(full_text)：流正常结束后回调，可用于保存对话。
    """
    if not LONGCAT_API_KEY:
        def missing_key():
            yield f"data: {json.dumps({'error': '未配置 LONGCAT_API_KEY，AI 功能不可用'})}\n\n"
        return Response(missing_key(), mimetype="text/event-stream")

    log_ai_usage(request.current_user.get("user_id"), endpoint)

    def generate():
        full_content = []
        completed = False

        def handle_line(line_text):
            """解析单行 SSE；返回 (是否结束, 新增文本)"""
            nonlocal completed
            if not line_text.startswith("data:"):
                return False, None
            chunk_data = line_text[5:].strip()
            if chunk_data == "[DONE]":
                completed = True
                return True, None
            try:
                parsed = json.loads(chunk_data)
                choices = parsed.get("choices") or []
                if not choices:
                    return False, None
                choice = choices[0]
                # 兼容 delta（流式）和 message（非流式）两种格式
                delta = (choice.get("delta", {}).get("content")
                         or choice.get("message", {}).get("content")
                         or "")
                if choice.get("finish_reason"):
                    completed = True
                    return True, delta
                return False, delta
            except (json.JSONDecodeError, IndexError, KeyError):
                return False, None

        try:
            response = requests.post(
                LONGCAT_API_URL,
                headers={
                    "Authorization": f"Bearer {LONGCAT_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL_NAME,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": True
                },
                stream=True,
                timeout=120
            )

            if response.status_code != 200:
                yield f"data: {json.dumps({'error': f'API 错误 {response.status_code}'})}\n\n"
                return

            # 用 iter_content 手动按行缓冲：iter_lines 默认 chunk_size=512，
            # 遇到超长 SSE 行会被拆碎导致 JSON 解析失败、内容丢失。
            buf = b""
            for raw in response.iter_content(chunk_size=None):
                if not raw:
                    continue
                buf += raw
                while b"\n" in buf:
                    line_bytes, buf = buf.split(b"\n", 1)
                    line_text = line_bytes.decode("utf-8", errors="replace").strip()
                    if not line_text:
                        continue
                    stop, delta = handle_line(line_text)
                    if delta:
                        full_content.append(delta)
                        yield f"data: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
                    if stop:
                        yield "data: [DONE]\n\n"
                        return
            # 处理缓冲区剩余内容
            if buf.strip():
                line_text = buf.decode("utf-8", errors="replace").strip()
                if line_text:
                    stop, delta = handle_line(line_text)
                    if delta:
                        full_content.append(delta)
                        yield f"data: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
                    if stop:
                        yield "data: [DONE]\n\n"
                        return
            completed = True
            yield "data: [DONE]\n\n"

        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'error': '请求超时'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if completed and on_complete and full_content:
                try:
                    on_complete("".join(full_content))
                except Exception as e:
                    print(f"[!] 流结束回调失败: {e}")

    return Response(generate(), mimetype="text/event-stream")


@app.route("/api/ai/proxy", methods=["POST"])
@login_required
def ai_proxy():
    """通用 AI 代理，流式转发"""
    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    return _sse_stream(
        data["messages"],
        data.get("max_tokens", 2000),
        data.get("temperature", 0.8),
        "proxy"
    )


# ==================== 星座 AI 分析接口 ====================
@app.route("/api/ai/zodiac", methods=["POST"])
@login_required
def zodiac_analysis():
    """星座深度 AI 分析"""
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    sign = data.get("sign", "")
    birth_date = data.get("birth_date", "")
    element = data.get("element", "")

    if not sign:
        return jsonify({"success": False, "error": "缺少星座信息"}), 400

    messages = [
        {
            "role": "system",
            "content": f"""你是一位专业的星座分析师，精通西方占星学。请根据用户的星座信息，给出详细、生动且个性化的分析。

要求：
1. 分析要有针对性，结合具体星座的特点
2. 语言生动有趣，像朋友在聊天
3. 给出实用的生活建议
4. 不要使用 markdown 格式，用自然段落
5. 用空行分段，结构清晰"""
        },
        {
            "role": "user",
            "content": f"我的星座是{sign}，出生日期是{birth_date}，元素属性是{element}。请从以下方面详细分析：\n1. 性格特质与天赋潜能\n2. 今日运势（爱情、事业、财运、健康）\n3. 本周需要注意的事项\n4. 给这个星座的开运建议"
        }
    ]

    return _sse_stream(messages, 3000, 0.8, "zodiac")


# ==================== 解梦知识库接口 ====================
@app.route("/api/dreams", methods=["GET"])
def list_dream_entries():
    keyword = request.args.get("keyword", "").strip()
    category = request.args.get("category", "").strip()
    try:
        page = max(1, int(request.args.get("page", 1)))
        page_size = min(50, max(1, int(request.args.get("page_size", 20))))
    except ValueError:
        return jsonify({"success": False, "error": "分页参数错误"}), 400

    items, total = list_dreams(keyword, category, page, page_size)
    return jsonify({
        "success": True,
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    })


@app.route("/api/dreams/categories", methods=["GET"])
def list_dream_categories():
    return jsonify({"success": True, "categories": dream_categories()})


@app.route("/api/dreams/<dream_id>", methods=["GET"])
def dream_detail(dream_id):
    item = get_dream(dream_id)
    if not item:
        return jsonify({"success": False, "error": "词条不存在"}), 404
    return jsonify({"success": True, "item": item})


@app.route("/api/dreams/rag", methods=["GET"])
def dream_rag():
    """返回解梦 RAG 检索结果，供前端展示知识库依据"""
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"success": True, "references": []})
    context, refs = rag_context(query, "dreams", top_k=3)
    return jsonify({"success": True, "references": refs, "context": context})


# ==================== 解梦 AI（RAG 增强） ====================
@app.route("/api/ai/dream", methods=["POST"])
@login_required
def dream_analysis():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    dream_content = (data.get("dream") or "").strip()
    if not dream_content:
        return jsonify({"success": False, "error": "请描述你的梦境"}), 400
    if len(dream_content) > 2000:
        return jsonify({"success": False, "error": "梦境描述过长（最多 2000 字）"}), 400

    context, _ = rag_context(dream_content, "dreams", top_k=3)
    system = """你是一位精通解梦的心理学家，熟悉周公解梦、弗洛伊德与荣格梦境分析理论。请根据用户描述的梦境，给出专业且易懂的解读。

要求：
1. 结合梦境中的具体意象进行分析
2. 从心理学角度解释梦境反映的内心状态
3. 给出实用的生活建议
4. 不要使用 markdown 格式，用自然段落
5. 语言温和有共情力，用空行分段"""

    if context:
        system += (
            "\n\n以下是从本地解梦知识库检索到的参考条目，"
            "请结合用户梦境灵活使用，不要照搬，也不要逐条罗列：\n" + context
        )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"用户梦境：{dream_content}\n\n请从关键意象、潜意识心理、生活启示三个方面解读。"},
    ]
    return _sse_stream(messages, 2200, 0.8, "dream")


# ==================== 八字 AI（RAG 增强） ====================
@app.route("/api/ai/bazi", methods=["POST"])
@login_required
def bazi_analysis():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"success": False, "error": "缺少排盘信息"}), 400

    context, _ = rag_context(prompt, "bazi", top_k=4)
    system = """你是一位精通八字命理的命理师，拥有三十年命理研究经验。请根据用户提供的排盘信息，给出详细、专业且易懂的分析。

要求：
1. 分析要有针对性，结合具体干支组合
2. 语言通俗易懂，深入浅出
3. 既要专业又要有实用性，给出具体建议
4. 不要使用 markdown 格式，用自然段落
5. 用空行分段，结构清晰"""

    if context:
        system += (
            "\n\n以下是命理知识库中的参考规则，可作为分析依据，"
            "请结合命盘灵活运用：\n" + context
        )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    return _sse_stream(messages, 3200, 0.8, "bazi")


# ==================== 紫微斗数 AI 解读 ====================
@app.route("/api/ai/ziwei", methods=["POST"])
@login_required
def ziwei_analysis():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"success": False, "error": "缺少排盘信息"}), 400

    context, _ = rag_context(prompt, "ziwei", top_k=6)
    system = """你是一位精通紫微斗数的命理师，拥有三十年命理研究经验。请根据用户提供的紫微斗数命盘，给出详细、专业且易懂的分析。

要求：
1. 分析要有针对性，结合具体星曜、宫位与四化飞星
2. 语言通俗易懂，深入浅出
3. 既要专业又要有实用性，给出具体建议
4. 不要使用 markdown 格式，用自然段落
5. 用空行分段，结构清晰
6. 涉及健康、婚姻等内容时给出建设性引导，避免绝对化断言"""

    if context:
        system += (
            "\n\n以下是紫微斗数知识库中的参考规则，可作为分析依据，"
            "请结合命盘灵活运用：\n" + context
        )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    return _sse_stream(messages, 3600, 0.8, "ziwei")


# ==================== 对话追问 ====================
DEFAULT_CHAT_SYSTEM = """你是一位温暖、有共情力的 AI 观象助手。你的职责是帮助用户解答关于感情、运势、人际关系等方面的困惑。

要求：
1. 始终保持积极、正向的引导
2. 语言温暖自然，像朋友在聊天
3. 回答要有实用性，给出具体建议
4. 不要使用 markdown 格式，用自然段落
5. 每次回答控制在 200-400 字
6. 用空行分段，结构清晰

你可以引导用户使用站内功能。当用户想使用某个功能时，先正常回应用户，然后在回复的最后单独一行输出对应标记（只输出一个标记，不要解释标记本身）：
[[ACTION:zodiac]] 星座运势
[[ACTION:tarot]] 塔罗占卜
[[ACTION:dream]] 解梦
[[ACTION:bazi]] 八字命理
[[ACTION:ziwei]] 紫微斗数
例如用户说“我想玩塔罗牌”，就正常回应，最后一行写 [[ACTION:tarot]]。"""


@app.route("/api/ai/chat", methods=["POST"])
@login_required
def ai_chat():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"success": False, "error": "消息不能为空"}), 400
    if len(message) > 1000:
        return jsonify({"success": False, "error": "消息过长（最多 1000 字）"}), 400

    user_id = request.current_user["user_id"]
    conversation_id = data.get("conversation_id")
    if conversation_id:
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "会话参数错误"}), 400
        if not get_conversation(user_id, conversation_id):
            return jsonify({"success": False, "error": "会话不存在"}), 404
    else:
        conversation_id = create_conversation(
            user_id,
            title=message[:30],
            context_type=data.get("context_type", ""),
            context_id=data.get("context_id"),
        )

    add_message(conversation_id, "user", message)

    system = (data.get("system") or DEFAULT_CHAT_SYSTEM).strip()[:3000]
    context = ""
    reading_id = data.get("reading_id")
    if reading_id:
        try:
            reading = get_reading(user_id, int(reading_id))
        except (TypeError, ValueError):
            reading = None
        if reading:
            context = (
                "\n\n以下是用户之前的一次解读记录，请结合它回答追问：\n"
                f"类型：{reading['type']}\n"
                f"输入：{reading['input_data'][:800]}\n"
                f"结果：{reading['result'][:1500]}"
            )
    elif data.get("context"):
        context = "\n\n背景信息：\n" + str(data["context"])[:2000]

    history = get_messages(conversation_id, limit=20)
    messages = [{"role": "system", "content": system + context}] + history

    def save_reply(full_text):
        # 跳转标记只用于前端渲染按钮，落库时清理
        clean_text = re.sub(r"\[\[ACTION:[a-z]+\]\]", "", full_text).strip()
        add_message(conversation_id, "assistant", clean_text)
        save_reading(user_id, "聊天", message, clean_text)

    response = _sse_stream(
        messages,
        max_tokens=data.get("max_tokens", 1200),
        temperature=0.8,
        endpoint="chat",
        on_complete=save_reply,
    )
    response.headers["X-Conversation-Id"] = str(conversation_id)
    return response


@app.route("/api/chat/history", methods=["GET"])
@login_required
def chat_history():
    try:
        conversation_id = int(request.args.get("conversation_id", 0))
    except ValueError:
        return jsonify({"success": False, "error": "会话参数错误"}), 400

    conversation = get_conversation(request.current_user["user_id"], conversation_id)
    if not conversation:
        return jsonify({"success": False, "error": "会话不存在"}), 404

    return jsonify({
        "success": True,
        "conversation": conversation,
        "messages": get_messages(conversation_id, limit=50),
    })


@app.route("/api/chat/conversations", methods=["GET"])
@login_required
def chat_conversations():
    return jsonify({
        "success": True,
        "conversations": list_conversations(request.current_user["user_id"]),
    })


@app.route("/api/chat/inject", methods=["POST"])
@login_required
def chat_inject():
    """功能页把解读摘要写入会话，浮层聊天可接着追问"""
    data = request.get_json() or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"success": False, "error": "内容不能为空"}), 400

    user_id = request.current_user["user_id"]
    context_type = (data.get("context_type") or "").strip()[:20]

    reading_id = data.get("reading_id")
    try:
        reading_id = int(reading_id) if reading_id else None
    except (TypeError, ValueError):
        reading_id = None

    conversation_id = data.get("conversation_id")
    if conversation_id:
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "会话参数错误"}), 400
        if not get_conversation(user_id, conversation_id):
            return jsonify({"success": False, "error": "会话不存在"}), 404
    else:
        conversation_id = create_conversation(
            user_id,
            title=(data.get("title") or context_type or "解读摘要")[:30],
            context_type=context_type,
            context_id=reading_id,
        )

    add_message(conversation_id, "assistant", content[:4000])
    if reading_id:
        update_conversation_context(conversation_id, context_type, reading_id)

    return jsonify({"success": True, "conversation_id": conversation_id})


# ==================== 结构化输出 ====================
STRUCTURED_PROMPTS = {
    "tarot": """你是塔罗解读师。请只输出一个 JSON 对象，不要输出任何解释或代码块标记。
JSON 结构：
{"summary": "整体解读，80字以内", "cards": [{"position": "位置", "card": "牌名", "orientation": "正位/逆位", "interpretation": "该位置的解读，60字以内"}], "advice": ["建议1", "建议2", "建议3"]}""",
    "bazi": """你是八字命理师。请只输出一个 JSON 对象，不要输出任何解释或代码块标记。
JSON 结构：
{"summary": "命盘总评，100字以内", "personality": ["性格特点1", "性格特点2", "性格特点3"], "career": "事业财运建议，80字以内", "love": "感情建议，80字以内", "health": "健康提醒，60字以内", "advice": ["开运建议1", "开运建议2", "开运建议3"]}""",
    "zodiac": """你是星座分析师。请只输出一个 JSON 对象，不要输出任何解释或代码块标记。
JSON 结构：
{"summary": "今日总评，80字以内", "scores": {"love": 80, "career": 75, "wealth": 70, "health": 85}, "lucky_color": "幸运色", "lucky_number": 7, "advice": ["建议1", "建议2", "建议3"]}""",
}


def _call_model(messages, max_tokens=1200, temperature=0.4):
    """非流式调用模型，用于结构化输出"""
    if not LONGCAT_API_KEY:
        raise RuntimeError("未配置 LONGCAT_API_KEY")
    response = requests.post(
        LONGCAT_API_URL,
        headers={
            "Authorization": f"Bearer {LONGCAT_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL_NAME,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        },
        timeout=90,
    )
    if response.status_code != 200:
        raise RuntimeError(f"API 错误 {response.status_code}")
    payload = response.json()
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("模型未返回结果")
    message = choices[0].get("message") or {}
    content = (message.get("content") or "").strip()
    if not content:
        # LongCat 在 token 不足时可能只返回 reasoning_content
        raise RuntimeError("模型未返回正文（可能是 token 不足，请重试）")
    return content


def _extract_json(text):
    """从模型输出中提取 JSON，容忍代码块包裹"""
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


def _validate_structured(kind, data):
    if not isinstance(data, dict):
        return None
    if kind == "tarot":
        if not isinstance(data.get("summary"), str) or not isinstance(data.get("cards"), list):
            return None
        cards = []
        for item in data["cards"][:10]:
            if not isinstance(item, dict):
                continue
            cards.append({
                "position": str(item.get("position", "")),
                "card": str(item.get("card", "")),
                "orientation": str(item.get("orientation", "")),
                "interpretation": str(item.get("interpretation", "")),
            })
        if not cards:
            return None
        return {
            "summary": data["summary"],
            "cards": cards,
            "advice": [str(a) for a in data.get("advice", [])][:6],
        }
    if kind == "bazi":
        if not isinstance(data.get("summary"), str):
            return None
        return {
            "summary": data["summary"],
            "personality": [str(x) for x in data.get("personality", [])][:6],
            "career": str(data.get("career", "")),
            "love": str(data.get("love", "")),
            "health": str(data.get("health", "")),
            "advice": [str(a) for a in data.get("advice", [])][:6],
        }
    if kind == "zodiac":
        scores = data.get("scores")
        if not isinstance(scores, dict):
            return None
        clean_scores = {}
        for key in ("love", "career", "wealth", "health"):
            try:
                clean_scores[key] = max(0, min(100, int(scores.get(key, 0))))
            except (TypeError, ValueError):
                clean_scores[key] = 0
        return {
            "summary": str(data.get("summary", "")),
            "scores": clean_scores,
            "lucky_color": str(data.get("lucky_color", "")),
            "lucky_number": data.get("lucky_number", ""),
            "advice": [str(a) for a in data.get("advice", [])][:6],
        }
    return None


@app.route("/api/ai/structured", methods=["POST"])
@login_required
def ai_structured():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    kind = data.get("kind")
    payload = data.get("input")
    if kind not in STRUCTURED_PROMPTS or not isinstance(payload, dict):
        return jsonify({"success": False, "error": "参数错误"}), 400

    log_ai_usage(request.current_user["user_id"], f"structured-{kind}")
    messages = [
        {"role": "system", "content": STRUCTURED_PROMPTS[kind]},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)[:6000]},
    ]

    # 结构化输出需要预留推理 token，牌阵/命盘信息较多时给更大空间
    max_tokens = 3000 if kind in ("tarot", "bazi") else 2000
    try:
        text = _call_model(messages, max_tokens=max_tokens)
    except Exception as e:
        print(f"[!] 结构化输出失败（{kind}）：{e}")
        return jsonify({"success": False, "error": str(e)}), 502

    parsed = _extract_json(text)
    normalized = _validate_structured(kind, parsed) if parsed else None
    if normalized is None:
        # 降级：返回原始文本，前端按纯文本展示
        return jsonify({"success": True, "structured": False, "raw": text})

    return jsonify({"success": True, "structured": True, "data": normalized})


# ==================== 每日运势 ====================
ZODIAC_TRAITS = {
    "白羊座": ("火", "行动力"), "金牛座": ("土", "稳定感"),
    "双子座": ("风", "沟通力"), "巨蟹座": ("水", "共情力"),
    "狮子座": ("火", "自信心"), "处女座": ("土", "细节感"),
    "天秤座": ("风", "协调力"), "天蝎座": ("水", "洞察力"),
    "射手座": ("火", "探索欲"), "摩羯座": ("土", "执行力"),
    "水瓶座": ("风", "创造力"), "双鱼座": ("水", "直觉力"),
}

FORTUNE_COLORS = ["红色", "橙色", "黄色", "绿色", "青色", "蓝色", "紫色", "白色", "金色", "银色"]

FORTUNE_ADVICE = [
    "重要决定放在上午处理，思路更清晰",
    "主动联系一位久未联系的朋友，会有意外收获",
    "给自己留出一段独处时间，整理情绪",
    "适合推进搁置已久的计划，先完成最小的一步",
    "注意劳逸结合，别把日程排得太满",
    "遇到分歧时先听完对方，再表达自己的立场",
    "适合整理财务，控制不必要的冲动消费",
    "把想法写下来，比反复在脑中推演更有效",
    "运动或散步能帮你找回状态",
    "对帮助过你的人表达感谢，人缘会更好",
    "不要被短期波动影响判断，把眼光放长远",
    "今天适合学习一项新技能或读几页书",
]


FORTUNE_PERIODS = {
    "day": ("今日", "适合主动争取想要的机会"),
    "week": ("本周", "重要事项放在前半周推进更顺"),
    "month": ("本月", "适合做阶段性规划，稳步推进"),
    "year": ("今年", "适合把精力放在长期目标上"),
}

FORTUNE_SCORE_RANGE = {
    "day": (55, 95),
    "week": (58, 92),
    "month": (60, 90),
    "year": (62, 88),
}


def _china_now():
    return datetime.now(timezone(timedelta(hours=8)))


def _china_today():
    return _china_now().strftime("%Y-%m-%d")


def _period_key(dt, period):
    """返回 (缓存键, 展示用的时间范围)"""
    if period == "week":
        iso_year, iso_week, _ = dt.isocalendar()
        start = dt - timedelta(days=dt.weekday())
        end = start + timedelta(days=6)
        return f"{iso_year}-W{iso_week:02d}", f"{start:%Y-%m-%d} ~ {end:%Y-%m-%d}"
    if period == "month":
        start = dt.replace(day=1)
        next_month = (start + timedelta(days=32)).replace(day=1)
        end = next_month - timedelta(days=1)
        return start.strftime("%Y-%m"), f"{start:%Y-%m-%d} ~ {end:%Y-%m-%d}"
    if period == "year":
        return dt.strftime("%Y"), f"{dt.year}-01-01 ~ {dt.year}-12-31"
    return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")


def _build_fortune(sign, period, key, range_text):
    seed = int(hashlib.sha256(f"{sign}|{period}|{key}".encode("utf-8")).hexdigest()[:12], 16)
    rnd = random.Random(seed)
    low, high = FORTUNE_SCORE_RANGE[period]
    scores = {
        "love": rnd.randint(low, high),
        "career": rnd.randint(low, high),
        "wealth": rnd.randint(low, high),
        "health": rnd.randint(low, high),
    }
    overall = round(sum(scores.values()) / 4)
    element, trait = ZODIAC_TRAITS[sign]
    label, tail = FORTUNE_PERIODS[period]

    if overall >= 85:
        phrase = "能量充沛"
    elif overall >= 70:
        phrase = "运势平稳向上"
    else:
        phrase = "节奏偏缓"
        tail = "先照顾好状态，不必勉强推进"

    summary = f"{label}{sign}整体{phrase}，{trait}是你的助力，{tail}。"

    return {
        "sign": sign,
        "period": period,
        "period_label": label,
        "range": range_text,
        "element": element,
        "scores": scores,
        "overall": overall,
        "lucky_color": rnd.choice(FORTUNE_COLORS),
        "lucky_number": rnd.randint(1, 12),
        "summary": summary,
        "advice": rnd.sample(FORTUNE_ADVICE, 3),
    }


def _get_fortune(sign, period):
    """返回 (运势数据, 是否命中缓存)"""
    now = _china_now()
    key, range_text = _period_key(now, period)
    cached = get_fortune_cache(sign, key)
    if cached:
        return json.loads(cached), True

    data = _build_fortune(sign, period, key, range_text)
    save_fortune_cache(sign, key, json.dumps(data, ensure_ascii=False))
    return data, False


def _fortune_response(sign, period):
    data, cached = _get_fortune(sign, period)
    return jsonify({"success": True, "cached": cached, "data": data})


@app.route("/api/fortune/overview", methods=["GET"])
@login_required
def fortune_overview():
    """首页 12 星座运势总览，保证与详情页分数一致"""
    period = request.args.get("period", "day").strip()
    if period not in FORTUNE_PERIODS:
        return jsonify({"success": False, "error": "运势周期参数错误"}), 400

    fields = ("sign", "period", "period_label", "range", "overall",
              "summary", "lucky_color", "lucky_number", "scores")
    items = []
    for sign in ZODIAC_TRAITS:
        data, _ = _get_fortune(sign, period)
        items.append({key: data[key] for key in fields})

    return jsonify({"success": True, "period": period, "items": items})


@app.route("/api/fortune/period", methods=["GET"])
@login_required
def period_fortune():
    sign = request.args.get("sign", "").strip()
    period = request.args.get("period", "day").strip()
    if sign not in ZODIAC_TRAITS:
        return jsonify({"success": False, "error": "星座参数错误"}), 400
    if period not in FORTUNE_PERIODS:
        return jsonify({"success": False, "error": "运势周期参数错误"}), 400
    return _fortune_response(sign, period)


@app.route("/api/fortune/daily", methods=["GET"])
@login_required
def daily_fortune():
    sign = request.args.get("sign", "").strip()
    if sign not in ZODIAC_TRAITS:
        return jsonify({"success": False, "error": "星座参数错误"}), 400
    return _fortune_response(sign, "day")


# ==================== 健康检查 ====================
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "model": MODEL_NAME})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    print("=" * 50)
    print("[观象] 后端已启动！")
    print(f"[API]  http://localhost:{port}")
    print(f"[模型] {MODEL_NAME}")
    print("=" * 50)
    app.run(host="0.0.0.0", port=port, debug=debug)
