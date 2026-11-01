"""管理后台接口（Blueprint）"""

from flask import Blueprint, jsonify, request

from auth import admin_required
from models import (
    get_stats, list_users, set_user_status, set_user_role,
    reset_user_password, admin_list_readings, admin_delete_reading,
)
from retriever import (
    list_dreams, add_dream, update_dream, delete_dream, get_dream,
)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _page_args(default_size=20):
    try:
        page = max(1, int(request.args.get("page", 1)))
        page_size = min(100, max(1, int(request.args.get("page_size", default_size))))
    except ValueError:
        page, page_size = 1, default_size
    return page, page_size


@admin_bp.route("/stats", methods=["GET"])
@admin_required
def stats():
    return jsonify({"success": True, "stats": get_stats()})


@admin_bp.route("/users", methods=["GET"])
@admin_required
def users():
    page, page_size = _page_args()
    keyword = request.args.get("keyword", "").strip()
    items, total = list_users(keyword, page, page_size)
    return jsonify({
        "success": True, "users": items, "total": total,
        "page": page, "page_size": page_size,
    })


@admin_bp.route("/users/<int:user_id>/status", methods=["PUT"])
@admin_required
def user_status(user_id):
    if user_id == request.current_user["user_id"]:
        return jsonify({"success": False, "error": "不能修改自己的账号状态"}), 400
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("active", "disabled"):
        return jsonify({"success": False, "error": "状态参数错误"}), 400
    if not set_user_status(user_id, status):
        return jsonify({"success": False, "error": "用户不存在"}), 404
    return jsonify({"success": True})


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@admin_required
def user_role(user_id):
    if user_id == request.current_user["user_id"]:
        return jsonify({"success": False, "error": "不能修改自己的角色"}), 400
    data = request.get_json() or {}
    role = data.get("role")
    if role not in ("user", "admin"):
        return jsonify({"success": False, "error": "角色参数错误"}), 400
    if not set_user_role(user_id, role):
        return jsonify({"success": False, "error": "用户不存在"}), 404
    return jsonify({"success": True})


@admin_bp.route("/users/<int:user_id>/password", methods=["PUT"])
@admin_required
def user_password(user_id):
    data = request.get_json() or {}
    password = (data.get("password") or "").strip()
    if len(password) < 6:
        return jsonify({"success": False, "error": "密码至少 6 位"}), 400
    if not reset_user_password(user_id, password):
        return jsonify({"success": False, "error": "用户不存在"}), 404
    return jsonify({"success": True})


@admin_bp.route("/readings", methods=["GET"])
@admin_required
def readings():
    page, page_size = _page_args()
    reading_type = request.args.get("type", "").strip()
    keyword = request.args.get("keyword", "").strip()
    items, total = admin_list_readings(page, page_size, reading_type, keyword)
    return jsonify({
        "success": True, "readings": items, "total": total,
        "page": page, "page_size": page_size,
    })


@admin_bp.route("/readings/<int:reading_id>", methods=["DELETE"])
@admin_required
def remove_reading(reading_id):
    if not admin_delete_reading(reading_id):
        return jsonify({"success": False, "error": "记录不存在"}), 404
    return jsonify({"success": True})


@admin_bp.route("/dreams", methods=["GET"])
@admin_required
def dreams():
    page, page_size = _page_args()
    keyword = request.args.get("keyword", "").strip()
    category = request.args.get("category", "").strip()
    items, total = list_dreams(keyword, category, page, page_size)
    return jsonify({
        "success": True, "items": items, "total": total,
        "page": page, "page_size": page_size,
    })


@admin_bp.route("/dreams", methods=["POST"])
@admin_required
def create_dream():
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    traditional = (data.get("traditional") or "").strip()
    psychology = (data.get("psychology") or "").strip()
    keywords = data.get("keywords") or []

    if not title or not category or not traditional or not psychology:
        return jsonify({"success": False, "error": "标题、分类、两种释义都不能为空"}), 400
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]
    if not isinstance(keywords, list):
        return jsonify({"success": False, "error": "关键词格式错误"}), 400

    item = add_dream(title, category, keywords, traditional, psychology)
    return jsonify({"success": True, "item": item})


@admin_bp.route("/dreams/<dream_id>", methods=["PUT"])
@admin_required
def edit_dream(dream_id):
    if not get_dream(dream_id):
        return jsonify({"success": False, "error": "词条不存在"}), 404

    data = request.get_json() or {}
    fields = {}
    for key in ("title", "category", "traditional", "psychology"):
        if key in data:
            value = str(data[key]).strip()
            if not value:
                return jsonify({"success": False, "error": f"{key} 不能为空"}), 400
            fields[key] = value
    if "keywords" in data:
        keywords = data["keywords"]
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(",") if k.strip()]
        if not isinstance(keywords, list):
            return jsonify({"success": False, "error": "关键词格式错误"}), 400
        fields["keywords"] = keywords

    item = update_dream(dream_id, **fields)
    return jsonify({"success": True, "item": item})


@admin_bp.route("/dreams/<dream_id>", methods=["DELETE"])
@admin_required
def remove_dream(dream_id):
    if not delete_dream(dream_id):
        return jsonify({"success": False, "error": "词条不存在"}), 404
    return jsonify({"success": True})
