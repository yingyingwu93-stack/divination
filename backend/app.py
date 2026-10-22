"""
占卜平台后端
提供用户认证、历史记录、AI 代理接口
"""

from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import requests
import json
import time
import os

from models import (
    create_user, verify_user, get_user_by_id,
    save_reading, get_readings, delete_reading
)
from auth import generate_token, login_required

# 前端静态文件目录（项目根目录）
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)


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
        token = generate_token(user["id"], user["username"])
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
    readings = get_readings(request.current_user["user_id"], reading_type)
    return jsonify({"success": True, "readings": readings})


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

    save_reading(request.current_user["user_id"], reading_type, input_data, result)
    return jsonify({"success": True})


@app.route("/api/history/<int:reading_id>", methods=["DELETE"])
@login_required
def remove_history(reading_id):
    if delete_reading(request.current_user["user_id"], reading_id):
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "记录不存在"}), 404


# ==================== AI 代理接口 ====================
@app.route("/api/ai/proxy", methods=["POST"])
@login_required
def ai_proxy():
    """通用 AI 代理，流式转发"""
    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"success": False, "error": "请求格式错误"}), 400

    messages = data["messages"]
    max_tokens = data.get("max_tokens", 2000)
    temperature = data.get("temperature", 0.8)

    def generate():
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

            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")
                    if decoded.startswith("data:"):
                        chunk_data = decoded[5:].strip()
                        if chunk_data == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            parsed = json.loads(chunk_data)
                            choices = parsed.get("choices") or []
                            if not choices:
                                continue
                            choice = choices[0]
                            # 兼容 delta（流式）和 message（非流式）两种格式
                            delta = (choice.get("delta", {}).get("content")
                                     or choice.get("message", {}).get("content")
                                     or "")
                            if delta:
                                yield f"data: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
                            # 检查 finish_reason 判断是否结束
                            if choice.get("finish_reason"):
                                yield "data: [DONE]\n\n"
                                break
                        except (json.JSONDecodeError, IndexError, KeyError):
                            continue

        except requests.exceptions.Timeout:
            yield f"data: {json.dumps({'error': '请求超时'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype="text/event-stream")


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

    def generate():
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
                    "max_tokens": 3000,
                    "temperature": 0.8,
                    "stream": True
                },
                stream=True,
                timeout=120
            )

            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")
                    if decoded.startswith("data:"):
                        chunk_data = decoded[5:].strip()
                        if chunk_data == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            parsed = json.loads(chunk_data)
                            choices = parsed.get("choices") or []
                            if not choices:
                                continue
                            choice = choices[0]
                            delta = (choice.get("delta", {}).get("content")
                                     or choice.get("message", {}).get("content")
                                     or "")
                            if delta:
                                yield f"data: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
                            if choice.get("finish_reason"):
                                yield "data: [DONE]\n\n"
                                break
                        except (json.JSONDecodeError, IndexError, KeyError):
                            continue

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype="text/event-stream")


# ==================== 健康检查 ====================
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "model": MODEL_NAME})


if __name__ == "__main__":
    print("=" * 50)
    print("[占卜平台] 后端已启动！")
    print(f"[API]  http://localhost:5001")
    print(f"[模型] {MODEL_NAME}")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5001, debug=True)
