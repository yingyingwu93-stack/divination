"""JWT 认证模块"""

import jwt
import time
from functools import wraps
from flask import request, jsonify

# 密钥（生产环境应从环境变量读取）
SECRET_KEY = "zhanbu_secret_key_2024_graduation"
TOKEN_EXPIRE_DAYS = 7


def generate_token(user_id, username):
    """生成 JWT Token"""
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": time.time() + TOKEN_EXPIRE_DAYS * 86400,
        "iat": time.time()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token):
    """解码并验证 JWT Token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def login_required(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not token:
            return jsonify({"success": False, "error": "未登录"}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"success": False, "error": "登录已过期，请重新登录"}), 401

        request.current_user = payload
        return f(*args, **kwargs)
    return decorated
