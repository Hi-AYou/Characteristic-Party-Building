from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.member import Member
import bcrypt

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"error": "用户名和密码不能为空"}), 400

    user = User.query.filter_by(username=username, is_active=True).first()
    if not user:
        return jsonify({"error": "用户名或密码错误"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user.password_hash.encode("utf-8")):
        return jsonify({"error": "用户名或密码错误"}), 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "role": user.role,
            "branch_id": user.branch_id,
            "real_name": user.real_name,
        },
    )
    return jsonify({
        "access_token": token,
        "user": user.to_dict(),
    }), 200


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    党员自助注册（仅限 viewer 角色）。
    需提供姓名+学号与 Member 表比对，通过后创建账号并自动绑定所属党支部。
    """
    data = request.get_json()
    real_name  = (data.get("real_name")  or "").strip()
    student_id = (data.get("student_id") or "").strip()
    username   = (data.get("username")   or "").strip()
    password   = (data.get("password")   or "").strip()

    # 基本校验
    if not all([real_name, student_id, username, password]):
        return jsonify({"error": "姓名、学号、用户名、密码均不能为空"}), 400
    if len(password) < 6:
        return jsonify({"error": "密码至少6位"}), 400

    # 1. 比对 Member 表（姓名 + 学号必须同时匹配）
    member = Member.query.filter_by(student_id=student_id).first()
    if not member or member.name.strip() != real_name:
        return jsonify({"error": "您的姓名或学号不在党员名单中，请核对后重试"}), 403

    # 2. 检查用户名是否已被使用
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "该用户名已被使用，请换一个"}), 409

    # 3. 检查该学号是否已注册过账号
    if User.query.filter_by(student_id=student_id).first():
        return jsonify({"error": "该学号已注册账号，如忘记密码请联系党支书重置"}), 409

    # 4. 创建 viewer 账号，自动绑定对应支部
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(
        username=username,
        password_hash=hashed,
        real_name=real_name,
        role="viewer",
        branch_id=member.branch_id,
        student_id=student_id,
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "message": "注册成功，请登录",
        "branch_name": member.branch.name if member.branch else "",
    }), 201


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "用户不存在"}), 404
    return jsonify(user.to_dict()), 200
