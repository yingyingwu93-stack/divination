"""JWT 认证模块"""

import os
import time
from functools import wraps

import jwt
from flask import jsonify, request

from models import get_user_by_id

# 密钥（生产环境应从环境变量读取）
SECRET_KEY = os.environ.get("ZHANBU_SECRET_KEY", "zhanbu_secret_key_2024_graduation")
TOKEN_EXPIRE_DAYS = 7


def generate_token(user_id, username, role="user"):
    """生成 JWT Token"""
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": time.time() + TOKEN_EXPIRE_DAYS * 86400,
        "iat": time.time(),
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


def _current_user():
    token = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not token:
        return None, (jsonify({"success": False, "error": "未登录"}), 401)

    payload = decode_token(token)
    if not payload:
        return None, (jsonify({"success": False, "error": "登录已过期，请重新登录"}), 401)

    # 每次请求校验账号状态，禁用/删除的账号立即失效
    user = get_user_by_id(payload.get("user_id"))
    if not user or user["status"] != "active":
        return None, (jsonify({"success": False, "error": "账号不可用"}), 401)

    payload["role"] = user["role"]
    return payload, None


def login_required(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload, error = _current_user()
        if error:
            return error
        request.current_user = payload
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """管理员验证装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload, error = _current_user()
        if error:
            return error
        if payload.get("role") != "admin":
            return jsonify({"success": False, "error": "需要管理员权限"}), 403
        request.current_user = payload
        return f(*args, **kwargs)
    return decorated
