from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.user import User
from app.utils.decorators import role_required
import bcrypt

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


def _current_claims():
    return get_jwt()


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@users_bp.route("/", methods=["GET"])
@jwt_required()
def list_users():
    claims = _current_claims()
    role = claims.get("role")
    branch_id = claims.get("branch_id")

    if role == "super_admin":
        users = User.query.order_by(User.role, User.username).all()
    elif role == "secretary":
        users = (
            User.query
            .filter_by(branch_id=branch_id, role="viewer")
            .order_by(User.username)
            .all()
        )
    else:
        return jsonify({"error": "权限不足"}), 403

    return jsonify([u.to_dict() for u in users]), 200


@users_bp.route("/", methods=["POST"])
@role_required("super_admin")
def create_user():
    """超管创建超管或支书账号（viewer 通过自助注册创建）"""
    data = request.get_json()
    username  = (data.get("username") or "").strip()
    password  = (data.get("password") or "").strip()
    role      = data.get("role", "viewer")
    branch_id = data.get("branch_id")

    if not username or not password:
        return jsonify({"error": "用户名和密码不能为空"}), 400
    if role not in User.ROLES:
        return jsonify({"error": f"角色必须是 {User.ROLES} 之一"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "用户名已存在"}), 409

    user = User(
        username=username,
        password_hash=_hash(password),
        real_name=data.get("real_name", ""),
        role=role,
        branch_id=branch_id,
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@users_bp.route("/<int:user_id>", methods=["PUT"])
@role_required("super_admin")
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    if "real_name" in data:
        user.real_name = data["real_name"]
    if "role" in data:
        if data["role"] not in User.ROLES:
            return jsonify({"error": "角色非法"}), 400
        user.role = data["role"]
    if "branch_id" in data:
        user.branch_id = data["branch_id"]
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "password" in data and data["password"]:
        # 通过 update_password 同步刷新 password_changed_at
        user.update_password(_hash(data["password"]))

    db.session.commit()
    return jsonify(user.to_dict()), 200


@users_bp.route("/<int:user_id>", methods=["DELETE"])
@role_required("super_admin")
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if str(user.id) == get_jwt_identity():
        return jsonify({"error": "不能删除自己的账号"}), 400
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "已删除"}), 200


@users_bp.route("/<int:user_id>/reset-password", methods=["POST"])
@jwt_required()
def reset_password(user_id):
    """
    重置指定用户的密码。
    - super_admin：可重置任意 viewer 和 secretary 密码（不能重置其他 super_admin）
    - secretary：只能重置本支部的 viewer 密码
    """
    claims = _current_claims()
    operator_role = claims.get("role")
    operator_branch_id = claims.get("branch_id")

    if operator_role not in ("super_admin", "secretary"):
        return jsonify({"error": "权限不足"}), 403

    target = User.query.get_or_404(user_id)

    # 不能重置 super_admin 账号
    if target.role == "super_admin":
        return jsonify({"error": "不能重置超级管理员的密码"}), 403

    # 支书只能重置本支部的 viewer
    if operator_role == "secretary":
        if target.role != "viewer":
            return jsonify({"error": "只能重置普通查看用户的密码"}), 403
        if target.branch_id != operator_branch_id:
            return jsonify({"error": "只能重置本支部成员的密码"}), 403

    data = request.get_json()
    new_pwd = (data.get("new_password") or "").strip()
    if len(new_pwd) < 6:
        return jsonify({"error": "新密码至少6位"}), 400

    # update_password 同步刷新 password_changed_at，使被重置者旧 token 立即失效
    target.update_password(_hash(new_pwd))
    db.session.commit()
    return jsonify({"message": f"已重置 {target.real_name or target.username} 的密码"}), 200


@users_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """用户自己修改密码（需提供旧密码）"""
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    old_pwd = (data.get("old_password") or "").strip()
    new_pwd = (data.get("new_password") or "").strip()

    if not bcrypt.checkpw(old_pwd.encode("utf-8"), user.password_hash.encode("utf-8")):
        return jsonify({"error": "旧密码错误"}), 401
    if len(new_pwd) < 6:
        return jsonify({"error": "新密码至少6位"}), 400

    # update_password 同步刷新 password_changed_at，使自己的旧 token 失效
    user.update_password(_hash(new_pwd))
    db.session.commit()
    return jsonify({"message": "密码已更新，请重新登录"}), 200
